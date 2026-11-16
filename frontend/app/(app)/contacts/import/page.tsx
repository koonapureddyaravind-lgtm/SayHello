"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CloudUpload,
  Download,
  FileSpreadsheet,
  Gauge,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Table2,
  Tags,
  Trash2,
  TriangleAlert,
  UploadCloud,
  Users,
  Wand2,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { backendPath, apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";
import type {
  ContactImportErrorView,
  ContactImportStatus,
  ContactImportView,
  PageResponse
} from "@/lib/types";
import { crmKeys } from "@/components/features/crm/crm-keys";

const CHUNK_SIZE = 8 * 1024 * 1024;
const SAMPLE_BYTES = 256 * 1024;
const NONE = "__none__";
const TERMINAL: ContactImportStatus[] = ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"];
const ACTIVE: ContactImportStatus[] = ["QUEUED", "RUNNING"];

interface FieldDefinition {
  key: string;
  label: string;
  hint: string;
  required?: boolean;
  aliases: string[];
}

const FIELDS: FieldDefinition[] = [
  {
    key: "email",
    label: "Email address",
    hint: "Primary identity for email campaigns",
    aliases: ["email", "e-mail", "email address", "emailaddress", "mail", "work email"]
  },
  {
    key: "phone",
    label: "Phone / WhatsApp",
    hint: "Used for WhatsApp and SMS delivery",
    aliases: [
      "phone",
      "phone number",
      "phonenumber",
      "mobile",
      "mobile number",
      "whatsapp",
      "whatsapp number",
      "sms",
      "telephone",
      "tel",
      "number",
      "cell"
    ]
  },
  {
    key: "firstName",
    label: "First name",
    hint: "Personalisation and greetings",
    aliases: ["first name", "firstname", "first_name", "given name", "givenname", "fname"]
  },
  {
    key: "lastName",
    label: "Last name",
    hint: "Surname or family name",
    aliases: ["last name", "lastname", "last_name", "surname", "family name", "lname"]
  },
  {
    key: "externalId",
    label: "External ID",
    hint: "Your CRM or warehouse identifier",
    aliases: ["external id", "external_id", "externalid", "contact id", "contactid", "id"]
  },
  {
    key: "status",
    label: "Contact status",
    hint: "Active, unsubscribed, bounced or deleted",
    aliases: ["status", "contact status", "subscription status"]
  },
  {
    key: "tags",
    label: "Tags",
    hint: "Comma, semicolon or pipe separated",
    aliases: ["tags", "tag", "labels", "label", "list", "lists"]
  }
];

const STATUS_MESSAGES: Partial<Record<ContactImportStatus, string>> = {
  UPLOADING: "Uploading chunks",
  QUEUED: "Waiting for a worker",
  RUNNING: "Streaming rows into PostgreSQL",
  COMPLETED: "Import complete",
  PARTIAL: "Complete with skipped rows",
  FAILED: "Import failed",
  CANCELLED: "Import cancelled"
};

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value: string): string {
  const result = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (result || "attribute").slice(0, 100);
}

function autoMap(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const field of FIELDS) {
    const match = headers.find(
      (header) => !used.has(header) && field.aliases.includes(normalize(header))
    );
    if (match) {
      mapping[field.key] = match;
      used.add(match);
    }
  }
  return mapping;
}

function detectDelimiter(line: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const candidate of candidates) {
    let count = 0;
    let quoted = false;
    for (const character of line) {
      if (character === '"') quoted = !quoted;
      else if (character === candidate && !quoted) count += 1;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best === "\t" ? "TAB" : best;
}

function parseSample(text: string, maxRows = 7): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const separator = delimiter === "TAB" ? "\t" : delimiter;
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < clean.length && records.length < maxRows; index += 1) {
    const character = clean[index];
    if (quoted) {
      if (character === '"') {
        if (clean[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === separator) {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  const headers = (records.shift() ?? []).map((header, index) => {
    const trimmed = header.trim();
    return trimmed || `Column ${index + 1}`;
  });
  return { headers, rows: records.filter((record) => record.some((value) => value.trim() !== "")) };
}

function isTerminal(status?: ContactImportStatus | null): boolean {
  return Boolean(status && TERMINAL.includes(status));
}

function isActive(status?: ContactImportStatus | null): boolean {
  return Boolean(status && ACTIVE.includes(status));
}

function progressOf(job: ContactImportView | null): number {
  if (!job) return 0;
  if (job.progressPercent !== null && job.progressPercent !== undefined) return job.progressPercent;
  if (job.status === "UPLOADING" && job.totalChunks > 0) {
    return Math.round((job.uploadedChunks / job.totalChunks) * 100);
  }
  if (job.estimatedTotalRows > 0) {
    return Math.min(99, Math.round((job.processedRows / job.estimatedTotalRows) * 100));
  }
  return 0;
}

export default function BulkContactImportPage() {
  const queryClient = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const sampleRequest = React.useRef(0);

  const [stage, setStage] = React.useState<"upload" | "map" | "processing" | "done">("upload");
  const [file, setFile] = React.useState<File | null>(null);
  const [sample, setSample] = React.useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [job, setJob] = React.useState<ContactImportView | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [tagsInput, setTagsInput] = React.useState("");
  const [sourceLabel, setSourceLabel] = React.useState("CSV import");
  const [triggerAutomations, setTriggerAutomations] = React.useState(false);
  const [recordActivities, setRecordActivities] = React.useState(false);
  const [batchSize, setBatchSize] = React.useState(5000);
  const [dragActive, setDragActive] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ContactImportView | null>(null);

  const activeId = job?.id ?? null;
  const liveJob = useQuery({
    queryKey: crmKeys.imports.detail(activeId ?? "none"),
    queryFn: () => apiFetch<ContactImportView>(`/contacts/imports/${activeId}`),
    enabled: Boolean(activeId) && (stage === "processing" || stage === "done"),
    refetchInterval: stage === "processing" ? 2000 : false
  }).data ?? job;

  const historyQuery = useQuery({
    queryKey: crmKeys.imports.list(0, 8),
    queryFn: () =>
      apiFetch<PageResponse<ContactImportView>>("/contacts/imports", { query: { page: 0, size: 8 } }),
    refetchInterval: (query) =>
      query.state.data?.items.some((item) => isActive(item.status) || item.status === "UPLOADING")
        ? 5000
        : false
  });

  const errorsQuery = useQuery({
    queryKey: crmKeys.imports.errors(activeId ?? "none", 0, 50),
    queryFn: () =>
      apiFetch<PageResponse<ContactImportErrorView>>(`/contacts/imports/${activeId}/errors`, {
        query: { page: 0, size: 50 }
      }),
    enabled: Boolean(activeId) && stage === "done" && (liveJob?.errorCount ?? 0) > 0
  });

  React.useEffect(() => {
    if (stage !== "processing" || !liveJob || !isTerminal(liveJob.status)) return;
    setStage("done");
    void queryClient.invalidateQueries({ queryKey: crmKeys.contacts.all });
    void queryClient.invalidateQueries({ queryKey: crmKeys.tags });
    void queryClient.invalidateQueries({ queryKey: crmKeys.imports.all });
    if (liveJob.status === "FAILED") {
      toast.error(liveJob.lastError || "The import stopped before it finished.");
    } else if (liveJob.status === "CANCELLED") {
      toast.info("The import was cancelled.");
    } else {
      toast.success(
        `${formatNumber(liveJob.createdCount)} contacts created and ${formatNumber(
          liveJob.updatedCount
        )} updated.`
      );
    }
  }, [stage, liveJob, queryClient]);

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<ContactImportView>(`/contacts/imports/${id}/cancel`, { method: "POST" }),
    onSuccess: (updated) => {
      abortRef.current?.abort();
      setJob(updated);
      setUploading(false);
      setStage("upload");
      void queryClient.invalidateQueries({ queryKey: crmKeys.imports.all });
      toast.success("Import cancelled");
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError))
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<ContactImportView>(`/contacts/imports/${id}/retry`, { method: "POST" }),
    onSuccess: (updated) => {
      setJob(updated);
      setStage("processing");
      void queryClient.invalidateQueries({ queryKey: crmKeys.imports.all });
      toast.success("Import re-queued");
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/contacts/imports/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      setDeleteTarget(null);
      if (job?.id === id) resetWorkspace();
      void queryClient.invalidateQueries({ queryKey: crmKeys.imports.all });
      toast.success("Import record deleted");
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError))
  });

  function resetWorkspace() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStage("upload");
    setFile(null);
    setSample(null);
    setJob(null);
    setMapping({});
    setTagsInput("");
    setSourceLabel("CSV import");
    setTriggerAutomations(false);
    setRecordActivities(false);
    setBatchSize(5000);
    setUploading(false);
    setSubmitting(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function chooseFile(nextFile: File | null) {
    setError(null);
    setJob(null);
    setMapping({});
    setStage("upload");
    setFile(nextFile);
    setSample(null);
    if (!nextFile) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const requestId = sampleRequest.current + 1;
    sampleRequest.current = requestId;
    void nextFile
      .slice(0, SAMPLE_BYTES)
      .text()
      .then((text) => {
        if (sampleRequest.current === requestId) setSample(parseSample(text));
      })
      .catch(() => setSample(null));
  }

  async function uploadFile() {
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    setError(null);
    setUploading(true);
    abortRef.current = new AbortController();
    try {
      let current =
        job && job.status === "UPLOADING"
          ? job
          : await apiFetch<ContactImportView>("/contacts/imports", {
              method: "POST",
              body: {
                filename: file.name,
                sizeBytes: file.size,
                totalChunks: Math.max(1, Math.ceil(file.size / CHUNK_SIZE))
              }
            });
      setJob(current);
      void queryClient.invalidateQueries({ queryKey: crmKeys.imports.all });

      const startIndex = Math.min(current.uploadedChunks, current.totalChunks);
      for (let index = startIndex; index < current.totalChunks; index += 1) {
        if (abortRef.current?.signal.aborted) throw new DOMException("Aborted", "AbortError");
        const start = index * CHUNK_SIZE;
        const blob = file.slice(start, Math.min(file.size, start + CHUNK_SIZE));
        const formData = new FormData();
        formData.append("chunk", blob, `${file.name}.part-${index}`);
        current = await apiFetch<ContactImportView>(
          `/contacts/imports/${current.id}/chunks/${index}`,
          {
            method: "POST",
            body: formData,
            signal: abortRef.current?.signal
          }
        );
        setJob(current);
      }

      const refreshed = await apiFetch<ContactImportView>(`/contacts/imports/${current.id}`);
      setJob(refreshed);
      setMapping(autoMap(refreshed.columns));
      setStage("map");
      toast.success("Upload complete. Review the column mapping.");
    } catch (uploadError) {
      if (uploadError instanceof DOMException && uploadError.name === "AbortError") {
        return;
      }
      setError(errorMessage(uploadError));
      toast.error(errorMessage(uploadError));
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  }

  async function startImport() {
    if (!liveJob) return;
    const cleanMapping = Object.fromEntries(
      Object.entries(mapping).filter(([, header]) => header && header !== NONE)
    );
    if (!cleanMapping.email && !cleanMapping.phone) {
      setError("Map at least an email column or a phone column.");
      return;
    }
    const usedHeaders = new Set(Object.values(cleanMapping));
    const attributeMapping: Record<string, string> = {};
    for (const column of liveJob.columns) {
      if (!usedHeaders.has(column)) attributeMapping[column] = slug(column);
    }
    const tags = tagsInput
      .split(/[,;|]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 50);

    setSubmitting(true);
    setError(null);
    try {
      const updated = await apiFetch<ContactImportView>(`/contacts/imports/${liveJob.id}/complete`, {
        method: "POST",
        body: {
          mapping: cleanMapping,
          attributeMapping,
          tags,
          sourceLabel: sourceLabel.trim() || "IMPORT",
          triggerAutomations,
          recordActivities,
          batchSize
        }
      });
      setJob(updated);
      setStage("processing");
      void queryClient.invalidateQueries({ queryKey: crmKeys.imports.all });
      toast.success("Import queued. You can leave this page while it runs.");
    } catch (completeError) {
      setError(errorMessage(completeError));
      toast.error(errorMessage(completeError));
    } finally {
      setSubmitting(false);
    }
  }

  function resumeUpload() {
    void uploadFile();
  }

  async function cancelUpload() {
    const id = job?.id;
    abortRef.current?.abort();
    if (id) {
      try {
        await apiFetch<ContactImportView>(`/contacts/imports/${id}/cancel`, { method: "POST" });
      } catch {
        // The session may already be gone; resetting the workspace is enough.
      }
    }
    resetWorkspace();
  }

  function openHistory(item: ContactImportView) {
    if (item.status === "UPLOADING") {
      toast.info("That upload session was not finished. Choose the file again to restart it.");
      return;
    }
    setJob(item);
    setFile(null);
    setSample(null);
    setError(null);
    setStage(isActive(item.status) ? "processing" : "done");
  }

  function assignField(field: string, header: string) {
    setMapping((previous) => {
      const next = { ...previous };
      if (header === NONE) {
        delete next[field];
        return next;
      }
      for (const [key, value] of Object.entries(next)) {
        if (value === header && key !== field) delete next[key];
      }
      next[field] = header;
      return next;
    });
  }

  const columns = liveJob?.columns ?? [];
  const usedHeaders = new Set(Object.values(mapping));
  const attributeColumns = columns.filter((column) => !usedHeaders.has(column));
  const previewColumns = (columns.length > 0 ? columns : sample?.headers ?? []).slice(0, 7);
  const previewRows = (sample?.rows ?? []).slice(0, 4);
  const selectedFileProgress =
    file && job && job.fileSizeBytes > 0
      ? Math.min(100, Math.round((job.uploadedBytes / job.fileSizeBytes) * 100))
      : 0;
  const liveProgress = progressOf(liveJob);
  const stepIndex = stage === "upload" ? 0 : stage === "map" ? 1 : 2;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM · Imports"
        title="Bulk contact import"
        description="Stream millions or billions of CSV rows into comGpt with resumable uploads, live progress and replay-safe upserts."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/contacts">
                <ArrowLeft /> Back to contacts
              </Link>
            </Button>
            <Button variant="gradient" onClick={resetWorkspace}>
              <Sparkles /> New import
            </Button>
          </>
        }
      />

      <div className="relative overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-700 p-6 text-white shadow-[0_30px_80px_-40px_rgba(124,58,237,0.8)] dark:border-violet-500/30">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-sky-400/30 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] backdrop-blur">
              <ShieldCheck className="size-3.5" /> Built for planet-scale files
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Upload once. Workers stream the rest.
            </h2>
            <p className="text-sm text-white/75">
              Files are split into 8 MB chunks, staged on a shared durable volume and processed in
              transactional batches. Restarts resume from the last committed record.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Chunked", value: "8 MB" },
              { label: "Batch upsert", value: "5k rows" },
              { label: "Memory", value: "O(1)" }
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="font-display text-lg font-semibold">{item.value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Stepper current={stepIndex} />

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
          <XCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {stage === "upload" ? (
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle>1. Choose your CSV</CardTitle>
                  <CardDescription>
                    First row must contain column names. UTF-8 and RFC 4180 quoting are supported.
                  </CardDescription>
                </div>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                  Step 1 of 3
                </span>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragActive(false);
                    chooseFile(event.dataTransfer.files?.[0] ?? null);
                  }}
                  className={cn(
                    "group relative flex w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-dashed px-6 py-12 text-center transition-all",
                    dragActive
                      ? "border-violet-400 bg-violet-50/90 dark:border-violet-400/60 dark:bg-violet-500/10"
                      : "border-border/80 bg-secondary/25 hover:border-violet-300 hover:bg-violet-50/60 dark:bg-white/[0.02] dark:hover:border-violet-400/40 dark:hover:bg-white/[0.04]"
                  )}
                >
                  <span className="absolute inset-x-10 -top-16 h-28 rounded-full bg-brand-gradient opacity-10 blur-3xl transition-opacity group-hover:opacity-25" />
                  <span className="relative flex size-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
                    <CloudUpload className="size-6" />
                  </span>
                  <span className="relative font-display text-base font-semibold">
                    {file ? file.name : "Drop your CSV here, or browse"}
                  </span>
                  <span className="relative text-xs text-muted-foreground">
                    {file
                      ? `${formatBytes(file.size)} · ${formatNumber(
                          Math.max(1, Math.ceil(file.size / CHUNK_SIZE))
                        )} chunks · click to choose another file`
                      : "Any size. Uploads resume from the last received chunk."}
                  </span>
                </button>

                {file ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        <FileSpreadsheet className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {sample
                            ? `${formatNumber(sample.headers.length)} columns · ${formatNumber(
                                sample.rows.length
                              )}+ sampled rows`
                            : "Reading column sample…"}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => chooseFile(null)}>
                      Remove
                    </Button>
                  </div>
                ) : null}

                {job && job.status === "UPLOADING" && job.uploadedChunks > 0 ? (
                  <div className="space-y-2 rounded-2xl border border-sky-200/70 bg-sky-50/70 p-4 dark:border-sky-500/25 dark:bg-sky-500/10">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-sky-800 dark:text-sky-200">
                        Upload paused at {formatNumber(job.uploadedChunks)} of{" "}
                        {formatNumber(job.totalChunks)} chunks
                      </span>
                      <span className="text-sky-700 dark:text-sky-300">{selectedFileProgress}%</span>
                    </div>
                    <Progress value={selectedFileProgress} tone="sky" />
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-emerald-500" />
                    Row-level errors never abort the whole import.
                  </p>
                  <div className="flex items-center gap-2">
                    {uploading ? (
                      <Button variant="outline" onClick={() => void cancelUpload()}>
                        Cancel upload
                      </Button>
                    ) : null}
                    <Button
                      variant="gradient"
                      loading={uploading}
                      onClick={() => void (job?.status === "UPLOADING" && job.uploadedChunks > 0 ? resumeUpload() : uploadFile())}
                      disabled={!file}
                    >
                      <UploadCloud />
                      {job?.status === "UPLOADING" && job.uploadedChunks > 0
                        ? "Resume upload"
                        : "Upload and continue"}
                    </Button>
                  </div>
                </div>

                {uploading && job ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-3.5 animate-spin" />
                        Uploading chunk {formatNumber(job.uploadedChunks + 1)} of{" "}
                        {formatNumber(job.totalChunks)}
                      </span>
                      <span>{formatBytes(job.uploadedBytes)} / {formatBytes(job.fileSizeBytes)}</span>
                    </div>
                    <Progress value={selectedFileProgress} tone="gradient" />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {stage === "map" && liveJob ? (
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle>2. Match your columns</CardTitle>
                  <CardDescription>
                    {formatNumber(columns.length)} columns detected
                    {liveJob.delimiter ? ` · delimiter "${liveJob.delimiter === "\t" ? "TAB" : liveJob.delimiter}"` : ""}.
                    We pre-filled the obvious matches.
                  </CardDescription>
                </div>
                <span className="rounded-full bg-fuchsia-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-200">
                  Step 2 of 3
                </span>
              </CardHeader>
              <CardContent className="space-y-6">
                {previewColumns.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-border/60">
                    <div className="flex items-center justify-between border-b border-border/60 bg-secondary/40 px-4 py-2.5">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Table2 className="size-3.5" /> Sample rows
                      </p>
                      <span className="text-[11px] text-muted-foreground">
                        showing {previewColumns.length} of {columns.length || sample?.headers.length || 0} columns
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {previewColumns.map((column) => (
                              <TableHead key={column} className="whitespace-nowrap text-xs">
                                {column}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={previewColumns.length} className="text-sm text-muted-foreground">
                                Preview is not available, but the full file will still be processed.
                              </TableCell>
                            </TableRow>
                          ) : (
                            previewRows.map((row, rowIndex) => (
                              <TableRow key={rowIndex}>
                                {previewColumns.map((column, columnIndex) => (
                                  <TableCell key={column} className="max-w-[220px] truncate text-xs">
                                    {row[columnIndex] ?? ""}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  {FIELDS.map((field) => {
                    const value = mapping[field.key] || NONE;
                    const requiredMissing = field.required && value === NONE;
                    return (
                      <div key={field.key} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={`map-${field.key}`} className="flex items-center gap-1.5">
                            {field.label}
                            {field.required ? <span className="text-rose-500">*</span> : null}
                          </Label>
                          {value !== NONE ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                              <Check className="size-3" /> mapped
                            </span>
                          ) : null}
                        </div>
                        <Select value={value} onValueChange={(next) => assignField(field.key, next)}>
                          <SelectTrigger
                            id={`map-${field.key}`}
                            className={cn(requiredMissing && "border-amber-300/70 dark:border-amber-400/40")}
                          >
                            <SelectValue placeholder="Not mapped" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Do not import</SelectItem>
                            {columns.map((column) => (
                              <SelectItem key={column} value={column}>
                                {column}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">{field.hint}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4 dark:bg-white/[0.03]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Wand2 className="size-3.5" /> Stored as attributes
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {attributeColumns.length} extra columns
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {attributeColumns.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Every column is mapped to a core contact field.
                      </span>
                    ) : (
                      attributeColumns.slice(0, 18).map((column) => (
                        <span
                          key={column}
                          className="rounded-full border border-violet-200/70 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-200"
                        >
                          {column} → {slug(column)}
                        </span>
                      ))
                    )}
                    {attributeColumns.length > 18 ? (
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                        +{attributeColumns.length - 18} more
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="import-tags" className="flex items-center gap-1.5">
                      <Tags className="size-3.5" /> Apply tags
                    </Label>
                    <Input
                      id="import-tags"
                      value={tagsInput}
                      onChange={(event) => setTagsInput(event.target.value)}
                      placeholder="newsletter, webinar-2026, vip"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Separated by commas. Applied to every created or updated contact.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="import-source">Source label</Label>
                    <Input
                      id="import-source"
                      value={sourceLabel}
                      onChange={(event) => setSourceLabel(event.target.value)}
                      placeholder="CSV import"
                      maxLength={120}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Shown on the contact timeline for traceability.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Trigger automations</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Off by default for very large files to protect throughput.
                        </p>
                      </div>
                      <Switch
                        checked={triggerAutomations}
                        onCheckedChange={setTriggerAutomations}
                        aria-label="Trigger automations"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Record activities</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Adds a timeline entry per contact. Best for smaller imports.
                        </p>
                      </div>
                      <Switch
                        checked={recordActivities}
                        onCheckedChange={setRecordActivities}
                        aria-label="Record activities"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Label htmlFor="batch-size" className="text-xs text-muted-foreground">
                      Commit batch
                    </Label>
                    <Select value={String(batchSize)} onValueChange={(value) => setBatchSize(Number(value))}>
                      <SelectTrigger id="batch-size" className="h-9 w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1000">1,000 rows</SelectItem>
                        <SelectItem value="5000">5,000 rows</SelectItem>
                        <SelectItem value="10000">10,000 rows</SelectItem>
                        <SelectItem value="20000">20,000 rows</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setStage("upload")} disabled={submitting}>
                      <ArrowLeft /> Back
                    </Button>
                    <Button variant="gradient" loading={submitting} onClick={() => void startImport()}>
                      <Gauge /> Start import
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {stage === "processing" || stage === "done" ? (
            liveJob ? (
              <ImportProgressCard
                job={liveJob}
                progress={liveProgress}
                cancellable={isActive(liveJob.status)}
                onCancel={() => cancelMutation.mutate(liveJob.id)}
                cancelling={cancelMutation.isPending}
                onRetry={() => retryMutation.mutate(liveJob.id)}
                retrying={retryMutation.isPending}
                onNew={resetWorkspace}
                errors={errorsQuery.data?.items ?? []}
                errorsLoading={errorsQuery.isLoading}
                errorDownloadHref={backendPath(`/contacts/imports/${liveJob.id}/errors.csv`)}
              />
            ) : (
              <Card>
                <CardContent className="py-10">
                  <EmptyState
                    icon={CloudUpload}
                    title="No import selected"
                    description="Start a new upload or open a previous import from the history below."
                    action={<Button onClick={resetWorkspace}>Start new import</Button>}
                  />
                </CardContent>
              </Card>
            )
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="size-4 text-violet-500" /> What happens next
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {[
                {
                  icon: UploadCloud,
                  title: "Chunks land on shared storage",
                  body: "Each 8 MB part is acknowledged independently, so a dropped connection resumes where it stopped."
                },
                {
                  icon: Loader2,
                  title: "A worker claims the job",
                  body: "The job row is locked, the file is assembled and rows stream through a bounded buffer."
                },
                {
                  icon: ShieldCheck,
                  title: "Batches commit atomically",
                  body: "Contacts, tags, errors and the resume offset commit together. Replaying a batch is safe."
                },
                {
                  icon: CheckCircle2,
                  title: "You get a full receipt",
                  body: "Created, updated, skipped and failed counts plus a downloadable CSV of row-level errors."
                }
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                    <item.icon className={cn("size-4", item.icon === Loader2 && "animate-spin")} />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-fuchsia-500" /> Deduplication rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                Rows match existing contacts by lower-cased email first, then by normalised phone.
                Matches update the profile; new identities create a contact.
              </p>
              <p>
                An email and phone that belong to two different contacts is reported as a row error
                instead of silently merging records.
              </p>
              <p>
                Identical identities inside the same upload are skipped after the first occurrence.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-sky-500" /> Import history
            </CardTitle>
            <CardDescription>The latest 8 sessions. Active jobs refresh automatically.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void historyQuery.refetch()}
            loading={historyQuery.isFetching}
          >
            <RefreshCw /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading imports…
            </div>
          ) : (historyQuery.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="No imports yet"
              description="Your first bulk upload will appear here with live progress and receipts."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyQuery.data?.items.map((item) => {
                    const ratio = progressOf(item);
                    return (
                      <TableRow key={item.id} className={cn(job?.id === item.id && "bg-violet-50/60 dark:bg-violet-500/10")}>
                        <TableCell className="max-w-[220px]">
                          <button
                            type="button"
                            className="block w-full truncate text-left text-sm font-medium hover:text-violet-600 dark:hover:text-violet-300"
                            onClick={() => openHistory(item)}
                            disabled={item.status === "UPLOADING"}
                          >
                            {item.filename}
                          </button>
                          <p className="text-[11px] text-muted-foreground">{formatBytes(item.fileSizeBytes)}</p>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} />
                        </TableCell>
                        <TableCell className="min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={ratio}
                              tone={item.status === "FAILED" ? "rose" : item.status === "PARTIAL" ? "amber" : "gradient"}
                              className="w-20"
                            />
                            <span className="text-[11px] text-muted-foreground">{ratio}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatNumber(item.processedRows)}
                          {item.totalRows > item.processedRows ? ` / ${formatNumber(item.totalRows)}` : ""}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="text-emerald-600 dark:text-emerald-300">+{formatNumber(item.createdCount)}</span>
                          {" · "}
                          <span className="text-violet-600 dark:text-violet-300">↻{formatNumber(item.updatedCount)}</span>
                          {item.errorCount > 0 ? (
                            <span className="text-amber-600 dark:text-amber-300"> · !{formatNumber(item.errorCount)}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => openHistory(item)} aria-label="Open import">
                              <ArrowRight />
                            </Button>
                            {isActive(item.status) ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => cancelMutation.mutate(item.id)}
                                aria-label="Cancel import"
                              >
                                <XCircle />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setDeleteTarget(item)}
                                aria-label="Delete import record"
                              >
                                <Trash2 />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete import record?"
        description={
          deleteTarget
            ? `The job history and stored errors for "${deleteTarget.filename}" will be removed. Contacts already imported stay in your directory.`
            : undefined
        }
        confirmLabel="Delete record"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  const steps = [
    { label: "Upload", hint: "Chunked and resumable" },
    { label: "Map columns", hint: "Match and enrich" },
    { label: "Process", hint: "Live progress" }
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => {
        const complete = index < current;
        const active = index === current;
        return (
          <div
            key={step.label}
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all",
              active
                ? "border-violet-300/70 bg-violet-50/70 shadow-soft dark:border-violet-400/30 dark:bg-violet-500/10"
                : complete
                  ? "border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                  : "border-border/60 bg-card/60"
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                active
                  ? "bg-brand-gradient text-white shadow-glow"
                  : complete
                    ? "bg-emerald-500 text-white"
                    : "bg-secondary text-muted-foreground"
              )}
            >
              {complete ? <Check className="size-4" /> : index + 1}
            </span>
            <div>
              <p className={cn("text-sm font-semibold", active && "text-violet-700 dark:text-violet-200")}>{step.label}</p>
              <p className="text-[11px] text-muted-foreground">{step.hint}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ImportProgressCard({
  job,
  progress,
  cancellable,
  cancelling,
  onCancel,
  onRetry,
  retrying,
  onNew,
  errors,
  errorsLoading,
  errorDownloadHref
}: {
  job: ContactImportView;
  progress: number;
  cancellable: boolean;
  cancelling: boolean;
  onCancel: () => void;
  onRetry: () => void;
  retrying: boolean;
  onNew: () => void;
  errors: ContactImportErrorView[];
  errorsLoading: boolean;
  errorDownloadHref: string;
}) {
  const terminal = isTerminal(job.status);
  const partial = job.status === "PARTIAL" || job.errorCount > 0;
  return (
    <Card className="overflow-hidden">
      <div
        className={cn(
          "relative border-b border-border/60 p-6",
          job.status === "FAILED"
            ? "bg-gradient-to-br from-rose-500 via-red-500 to-orange-600 text-white"
            : job.status === "CANCELLED"
              ? "bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700 text-white"
              : "bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-700 text-white"
        )}
      >
        <div className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-white/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={job.status} className="border-white/25 bg-white/15 text-white" />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
                {STATUS_MESSAGES[job.status] ?? job.status}
              </span>
            </div>
            <h2 className="mt-3 truncate font-display text-2xl font-semibold">{job.filename}</h2>
            <p className="mt-1 text-sm text-white/70">
              {formatBytes(job.fileSizeBytes)} · {formatNumber(job.totalRows)} rows ·{" "}
              {formatDateTime(job.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-4xl font-semibold">{terminal && job.status !== "FAILED" ? 100 : progress}%</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
              {terminal ? "Finished" : "Live progress"}
            </p>
          </div>
        </div>
        <div className="relative mt-5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/20">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                job.status === "FAILED" ? "bg-white/80" : "bg-gradient-to-r from-white via-amber-200 to-emerald-300"
              )}
              style={{ width: `${terminal && job.status !== "FAILED" ? 100 : progress}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/70">
            <span>
              {formatNumber(job.processedRows)} of{" "}
              {formatNumber(job.estimatedTotalRows || job.totalRows)} estimated rows
            </span>
            <span className="inline-flex items-center gap-1">
              {!terminal ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
              {terminal ? "Worker released the job lock" : "Safe to close this tab — processing continues"}
            </span>
          </div>
        </div>
      </div>

      <CardContent className="space-y-5 p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile label="Created" value={job.createdCount} tone="emerald" />
          <MetricTile label="Updated" value={job.updatedCount} tone="violet" />
          <MetricTile label="Skipped" value={job.skippedCount} tone="amber" />
          <MetricTile label="Failed" value={job.failedCount} tone="rose" />
        </div>

        {job.lastError ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/70 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Last error</p>
              <p className="mt-0.5 text-xs leading-relaxed">{job.lastError}</p>
            </div>
          </div>
        ) : null}

        {partial && terminal ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">
                {formatNumber(job.errorCount)} rows need attention
              </p>
              <p className="mt-0.5 text-xs leading-relaxed">
                Stored errors are sampled to the first 500 per job. Download the CSV to correct and
                re-import only those rows.
              </p>
            </div>
          </div>
        ) : null}

        {terminal && job.errorCount > 0 ? (
          <div className="rounded-2xl border border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-secondary/30 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Row errors {errorsLoading ? "· loading" : `· showing ${errors.length}`}
              </p>
              <Button asChild variant="outline" size="sm">
                <a href={errorDownloadHref} download>
                  <Download /> Download CSV
                </a>
              </Button>
            </div>
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Row</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-sm text-muted-foreground">
                        {errorsLoading ? "Loading row errors…" : "No stored row errors for this import."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    errors.map((row, index) => (
                      <TableRow key={`${row.rowNumber}-${index}`}>
                        <TableCell className="text-xs text-muted-foreground">{formatNumber(row.rowNumber)}</TableCell>
                        <TableCell className="text-xs">{row.message}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {job.status === "COMPLETED"
              ? "Every row was processed successfully."
              : job.status === "PARTIAL"
                ? "Valid rows were imported; skipped rows are listed above."
                : job.status === "CANCELLED"
                  ? "Committed batches remain. The rest of the file was not processed."
                  : job.status === "FAILED"
                    ? "The job stopped. Retry after fixing the cause, or start a new upload."
                    : "Processing continues in the worker even if you navigate away."}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {cancellable ? (
              <Button variant="outline" onClick={onCancel} loading={cancelling}>
                <XCircle /> Cancel import
              </Button>
            ) : null}
            {job.status === "FAILED" || job.status === "CANCELLED" ? (
              <Button variant="outline" onClick={onRetry} loading={retrying}>
                <RotateCcw /> Retry
              </Button>
            ) : null}
            <Button variant="gradient" onClick={onNew}>
              <Sparkles /> Start another import
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "emerald" | "violet" | "amber" | "rose";
}) {
  const tones = {
    emerald: "border-emerald-200/70 bg-emerald-50/60 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200",
    violet: "border-violet-200/70 bg-violet-50/60 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200",
    amber: "border-amber-200/70 bg-amber-50/60 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200",
    rose: "border-rose-200/70 bg-rose-50/60 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
  };
  return (
    <div className={cn("rounded-2xl border p-4", tones[tone])}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{formatNumber(value)}</p>
    </div>
  );
}
