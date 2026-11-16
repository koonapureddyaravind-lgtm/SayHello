"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, FileJson, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { crmKeys } from "@/components/features/crm/crm-keys";

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

interface ImportEnvelope {
  success?: boolean;
  data?: ImportResult;
  error?: { message?: string };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImportSummary({ result }: { result: ImportResult }) {
  const clean = result.skipped === 0 && result.errors.length === 0;
  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border p-4",
          clean
            ? "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/10"
            : "border-amber-200/70 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/10"
        )}
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
            clean ? "from-emerald-500 to-teal-600" : "from-amber-400 to-orange-600"
          )}
        >
          {clean ? <CheckCircle2 className="size-5" /> : <TriangleAlert className="size-5" />}
        </span>
        <div>
          <p className="font-display text-sm font-semibold">
            {clean ? "Import complete" : "Import finished with notes"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNumber(result.created)} created · {formatNumber(result.updated)} updated ·{" "}
            {formatNumber(result.skipped)} skipped
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Created", value: result.created, tone: "text-emerald-600 dark:text-emerald-300" },
          { label: "Updated", value: result.updated, tone: "text-violet-600 dark:text-violet-300" },
          { label: "Skipped", value: result.skipped, tone: "text-amber-600 dark:text-amber-300" }
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-border/60 bg-secondary/30 p-3 text-center dark:bg-white/[0.03]">
            <p className={cn("font-display text-xl font-semibold", metric.tone)}>{formatNumber(metric.value)}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{metric.label}</p>
          </div>
        ))}
      </div>

      {result.errors.length > 0 ? (
        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-3 dark:bg-white/[0.03]">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Row notes</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {result.errors.map((error, index) => (
              <li key={`${index}-${error}`} className="flex gap-2">
                <span className="text-amber-500">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ImportContactsDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [tab, setTab] = React.useState<"csv" | "json">("csv");
  const [file, setFile] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [jsonText, setJsonText] = React.useState("");
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTab("csv");
    setFile(null);
    setDragActive(false);
    setJsonText("");
    setResult(null);
    setError(null);
    setImporting(false);
  }, [open]);

  function refreshContactQueries() {
    void queryClient.invalidateQueries({ queryKey: crmKeys.contacts.all });
    void queryClient.invalidateQueries({ queryKey: crmKeys.tags });
  }

  function chooseFile(nextFile: File | null) {
    setResult(null);
    setError(null);
    setFile(nextFile);
  }

  async function importCsv() {
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/backend/contacts/import", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });
      const payload = (await response.json().catch(() => null)) as ImportEnvelope | null;
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error?.message || `Import failed with status ${response.status}.`);
      }
      setResult(payload.data);
      toast.success(`Import complete — ${formatNumber(payload.data.created)} created`);
      refreshContactQueries();
    } catch (importError) {
      setError(errorMessage(importError));
      toast.error(errorMessage(importError));
    } finally {
      setImporting(false);
    }
  }

  async function importJson() {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setError("That isn’t valid JSON. Paste an array of contact objects and try again.");
      return;
    }
    const contacts =
      Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { contacts?: unknown }).contacts)
          ? (parsed as { contacts: unknown[] }).contacts
          : null;
    if (!contacts || contacts.length === 0) {
      setError("Provide a JSON array of contacts, either at the root or under a “contacts” key.");
      return;
    }
    setImporting(true);
    try {
      const data = await apiFetch<ImportResult>("/contacts/import-json", {
        method: "POST",
        body: { contacts }
      });
      setResult(data);
      toast.success(`Import complete — ${formatNumber(data.created)} created`);
      refreshContactQueries();
    } catch (importError) {
      setError(errorMessage(importError));
      toast.error(errorMessage(importError));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            Bring in a CSV export or paste JSON. Rows are upserted by email or phone, and tags are created on demand.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <ImportSummary result={result} />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button variant="gradient" onClick={() => setResult(null)}>
                Import more
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <Tabs value={tab} onValueChange={(value) => setTab(value as "csv" | "json")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="csv">
                  <FileSpreadsheet /> CSV file
                </TabsTrigger>
                <TabsTrigger value="json">
                  <FileJson /> JSON paste
                </TabsTrigger>
              </TabsList>

              <TabsContent value="csv" className="space-y-4">
                <div>
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
                      "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-9 text-center transition-all",
                      dragActive
                        ? "border-violet-400 bg-violet-50/80 dark:border-violet-400/60 dark:bg-violet-500/10"
                        : "border-border/80 bg-secondary/20 hover:border-violet-300 hover:bg-violet-50/50 dark:bg-white/[0.02] dark:hover:border-violet-400/40 dark:hover:bg-white/[0.04]"
                    )}
                  >
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
                      <Upload className="size-5" />
                    </span>
                    <span className="font-display text-sm font-semibold">
                      {file ? file.name : "Drop a CSV here, or browse"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {file
                        ? `${formatBytes(file.size)} · click to choose another file`
                        : "Headers: email, phone, first_name, last_name, tags"}
                    </span>
                  </button>
                  {file ? (
                    <div className="mt-2 flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-xs">
                      <span className="truncate text-muted-foreground">{file.name}</span>
                      <button
                        type="button"
                        className="font-semibold text-rose-600 hover:underline dark:text-rose-300"
                        onClick={() => {
                          chooseFile(null);
                          if (inputRef.current) inputRef.current.value = "";
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
                {error ? (
                  <p className="rounded-xl border border-rose-200/70 bg-rose-50/70 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
                    {error}
                  </p>
                ) : null}
                <DialogFooter>
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
                    Cancel
                  </Button>
                  <Button variant="gradient" onClick={() => void importCsv()} loading={importing} disabled={!file}>
                    <Upload /> Import CSV
                  </Button>
                </DialogFooter>
              </TabsContent>

              <TabsContent value="json" className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Paste contact objects</p>
                  <p className="text-xs text-muted-foreground">
                    Accepts a root array or <code className="rounded bg-secondary px-1 py-0.5">{"{ \"contacts\": [...] }"}</code>.
                    Fields: email, phone, firstName, lastName, tags, attributes.
                  </p>
                  <Textarea
                    value={jsonText}
                    onChange={(event) => {
                      setJsonText(event.target.value);
                      setError(null);
                    }}
                    placeholder={'[{"email":"ada@example.com","firstName":"Ada","tags":["vip"]}]'}
                    className="min-h-[190px] font-mono text-xs"
                    spellCheck={false}
                  />
                </div>
                {error ? (
                  <p className="rounded-xl border border-rose-200/70 bg-rose-50/70 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
                    {error}
                  </p>
                ) : null}
                <DialogFooter>
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
                    Cancel
                  </Button>
                  <Button
                    variant="gradient"
                    onClick={() => void importJson()}
                    loading={importing}
                    disabled={!jsonText.trim()}
                  >
                    <FileJson /> Import JSON
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
