"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addEdge, useEdgesState, useNodesState } from "@xyflow/react";
import type { Edge, OnConnect } from "@xyflow/react";
import {
  ArrowLeft,
  CalendarClock,
  ListChecks,
  Pause,
  Pencil,
  Play,
  Rocket,
  Settings2,
  Sparkles,
  Workflow as WorkflowIcon
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { NodePalette } from "@/components/features/automation/node-palette";
import { NodeConfigPanel } from "@/components/features/automation/node-config-panel";
import { TestWorkflowDialog } from "@/components/features/automation/test-workflow-dialog";
import { ExecutionsPanel } from "@/components/features/automation/executions-panel";
import type { StudioNode } from "@/components/features/automation/studio-types";
import {
  configString,
  isWorkflowNodeType,
  isWorkflowTriggerType,
  NODE_META_BY_KIND,
  TRIGGER_META
} from "@/components/features/automation/workflow-meta";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, formatRelative } from "@/lib/format";
import type {
  Workflow,
  WorkflowGraph,
  WorkflowNodeConfig,
  WorkflowNodeType,
  WorkflowTriggerType
} from "@/lib/types";

const WorkflowCanvas = dynamic(
  () => import("@/components/features/automation/workflow-canvas").then((module) => module.WorkflowCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[520px] w-full shimmer-bg rounded-3xl border border-border/70 dark:border-white/[0.08]" />
    )
  }
);

type StudioTab = "design" | "executions";
type StatusAction = "activate" | "pause";

function newId(kind: WorkflowNodeType): string {
  return `${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function labelFor(kind: WorkflowNodeType, config: WorkflowNodeConfig, fallbackTrigger: WorkflowTriggerType): string {
  if (kind === "trigger") {
    const raw = config.triggerType;
    return isWorkflowTriggerType(raw) ? TRIGGER_META[raw].label : TRIGGER_META[fallbackTrigger].label;
  }
  return NODE_META_BY_KIND[kind].label;
}

function normalizeConfig(
  kind: WorkflowNodeType,
  config: WorkflowNodeConfig | undefined,
  fallbackTrigger: WorkflowTriggerType
): WorkflowNodeConfig {
  const next: WorkflowNodeConfig = { ...(config ?? {}) };
  if (kind === "trigger" && !isWorkflowTriggerType(next.triggerType)) {
    next.triggerType = fallbackTrigger;
  }
  if (kind === "wait") {
    if (typeof next.amount !== "number" || !Number.isFinite(next.amount)) next.amount = 1;
    if (!next.unit) next.unit = "HOURS";
  }
  if (kind === "condition") {
    if (!next.field) next.field = "email";
    if (!next.operator) next.operator = "eq";
  }
  return next;
}

function defaultConfig(
  kind: WorkflowNodeType,
  triggerType: WorkflowTriggerType
): WorkflowNodeConfig {
  switch (kind) {
    case "trigger":
      return { triggerType };
    case "wait":
      return { amount: 1, unit: "HOURS" };
    case "condition":
      return { field: "email", operator: "eq", value: "" };
    case "send_email":
      return { subject: "", body: "" };
    case "send_whatsapp":
    case "send_sms":
      return { body: "" };
    case "add_tag":
      return { tagName: "" };
    case "webhook":
      return { url: "" };
    default:
      return {};
  }
}

function defaultNodes(triggerType: WorkflowTriggerType): StudioNode[] {
  return [
    {
      id: "trigger",
      type: "workflow",
      position: { x: 260, y: 30 },
      data: {
        label: TRIGGER_META[triggerType].label,
        kind: "trigger",
        config: { triggerType }
      }
    },
    {
      id: "end",
      type: "workflow",
      position: { x: 260, y: 260 },
      data: {
        label: NODE_META_BY_KIND.end.label,
        kind: "end",
        config: {}
      }
    }
  ];
}

function defaultEdges(): Edge[] {
  return [
    {
      id: "edge_trigger_end",
      source: "trigger",
      target: "end",
      type: "smoothstep",
      animated: true
    }
  ];
}

function buildStudioGraph(workflow: Workflow): { nodes: StudioNode[]; edges: Edge[] } {
  const graph = workflow.graph;
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return { nodes: defaultNodes(workflow.triggerType), edges: defaultEdges() };
  }

  const nextNodes: StudioNode[] = [];
  const knownIds = new Set<string>();

  graph.nodes.forEach((raw, index) => {
    if (!raw.id || !isWorkflowNodeType(raw.type)) return;
    const kind = raw.type;
    const config = normalizeConfig(kind, raw.config, workflow.triggerType);
    const rawX = raw.position?.x;
    const rawY = raw.position?.y;
    const hasPosition =
      typeof rawX === "number" &&
      typeof rawY === "number" &&
      Number.isFinite(rawX) &&
      Number.isFinite(rawY) &&
      (rawX !== 0 || rawY !== 0);

    nextNodes.push({
      id: raw.id,
      type: "workflow",
      position: hasPosition ? { x: rawX, y: rawY } : { x: 260, y: 30 + index * 160 },
      data: {
        label: labelFor(kind, config, workflow.triggerType),
        kind,
        config
      }
    });
    knownIds.add(raw.id);
  });

  if (nextNodes.length === 0) {
    return { nodes: defaultNodes(workflow.triggerType), edges: defaultEdges() };
  }

  const nextEdges: Edge[] = graph.edges
    .filter((edge) => knownIds.has(edge.source) && knownIds.has(edge.target))
    .map((edge, index) => ({
      id: `edge_${edge.source}_${edge.target}_${edge.sourceHandle ?? "out"}_${index}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      type: "smoothstep",
      animated: true
    }));

  return { nodes: nextNodes, edges: nextEdges };
}

function triggerConfigFrom(config: WorkflowNodeConfig): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const tagName = configString(config, "tagName").trim();
  const secret = configString(config, "secret").trim();
  if (tagName) result.tagName = tagName;
  if (secret) result.secret = secret;
  return result;
}

export default function WorkflowStudioPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const workflowId = Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? "";
  const queryClient = useQueryClient();

  const [nodes, setNodes, onNodesChange] = useNodesState<StudioNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<StudioTab>("design");
  const [workflowName, setWorkflowName] = React.useState("");
  const [workflowDescription, setWorkflowDescription] = React.useState("");
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [draftName, setDraftName] = React.useState("");
  const [draftDescription, setDraftDescription] = React.useState("");
  const [testOpen, setTestOpen] = React.useState(false);
  const initializedWorkflow = React.useRef<string | null>(null);

  const workflowQuery = useQuery({
    queryKey: ["workflows", "detail", workflowId],
    queryFn: () => apiFetch<Workflow>(`/workflows/${workflowId}`),
    enabled: Boolean(workflowId)
  });

  const workflow = workflowQuery.data;

  React.useEffect(() => {
    if (!workflow) return;
    if (initializedWorkflow.current === workflow.id) return;
    const graph = buildStudioGraph(workflow);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setWorkflowName(workflow.name);
    setWorkflowDescription(workflow.description ?? "");
    setSelectedNodeId(null);
    initializedWorkflow.current = workflow.id;
  }, [workflow, setNodes, setEdges]);

  React.useEffect(() => {
    if (selectedNodeId && !nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [nodes, selectedNodeId]);

  const selectedNode = React.useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const triggerNode = React.useMemo(
    () => nodes.find((node) => node.data.kind === "trigger") ?? null,
    [nodes]
  );

  const activeTriggerType = React.useMemo<WorkflowTriggerType>(() => {
    const raw = triggerNode?.data.config.triggerType;
    if (isWorkflowTriggerType(raw)) return raw;
    return workflow?.triggerType ?? "MANUAL";
  }, [triggerNode, workflow?.triggerType]);

  const nodeLabels = React.useMemo(() => {
    return Object.fromEntries(nodes.map((node) => [node.id, node.data.label])) as Record<string, string>;
  }, [nodes]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!workflow) throw new Error("Workflow is not available");
      if (!workflowName.trim()) throw new Error("Give your workflow a name before publishing");
      if (!nodes.some((node) => node.data.kind === "trigger")) {
        throw new Error("Add a trigger node before publishing");
      }
      if (!nodes.some((node) => node.data.kind === "end")) {
        throw new Error("Add an end node before publishing");
      }

      const triggerConfig = triggerConfigFrom(triggerNode?.data.config ?? {});
      const triggerType = activeTriggerType;

      await apiFetch<Workflow>(`/workflows/${workflow.id}`, {
        method: "PATCH",
        body: {
          name: workflowName.trim(),
          description: workflowDescription.trim(),
          triggerType,
          triggerConfig
        }
      });

      const graph: WorkflowGraph = {
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.data.kind,
          config:
            node.data.kind === "trigger"
              ? { ...node.data.config, triggerType }
              : node.data.config,
          position: { x: node.position.x, y: node.position.y }
        })),
        edges: edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? null
        }))
      };

      return apiFetch<Workflow>(`/workflows/${workflow.id}/publish`, {
        method: "POST",
        body: { graph }
      });
    },
    onSuccess: (published) => {
      toast.success(`Published version ${published.currentVersion}`, {
        description:
          published.status === "ACTIVE"
            ? "Your workflow is live and listening for its trigger."
            : "The graph is saved. Activate the workflow when you're ready."
      });
      queryClient.setQueryData<Workflow>(["workflows", "detail", workflowId], (previous) =>
        previous ? { ...previous, ...published, graph: published.graph ?? previous.graph } : published
      );
      void queryClient.invalidateQueries({ queryKey: ["workflows", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["workflows", "stats"] });
      void queryClient.invalidateQueries({ queryKey: ["workflows", "executions", workflowId] });
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const statusMutation = useMutation({
    mutationFn: async (action: StatusAction) => {
      if (!workflow) throw new Error("Workflow is not available");
      return apiFetch<Workflow>(`/workflows/${workflow.id}/${action}`, { method: "POST" });
    },
    onSuccess: (updated, action) => {
      toast.success(action === "activate" ? "Workflow activated" : "Workflow paused", {
        description:
          action === "activate"
            ? "New matching events will start running this journey."
            : "New events will be ignored until you activate it again."
      });
      queryClient.setQueryData<Workflow>(["workflows", "detail", workflowId], (previous) =>
        previous ? { ...previous, ...updated, graph: previous.graph } : previous
      );
      void queryClient.invalidateQueries({ queryKey: ["workflows", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["workflows", "stats"] });
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const addNode = React.useCallback(
    (kind: WorkflowNodeType) => {
      if ((kind === "trigger" || kind === "end") && nodes.some((node) => node.data.kind === kind)) {
        toast.error(kind === "trigger" ? "This journey already has a trigger" : "This journey already has an end");
        return;
      }
      const bottom = nodes.reduce((max, node) => Math.max(max, node.position.y), 20);
      const id = newId(kind);
      const config = defaultConfig(kind, activeTriggerType);
      const nextNode: StudioNode = {
        id,
        type: "workflow",
        position: { x: 250, y: bottom + 150 },
        selected: true,
        data: {
          label: labelFor(kind, config, activeTriggerType),
          kind,
          config
        }
      };
      setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), nextNode]);
      setSelectedNodeId(id);
    },
    [nodes, setNodes, activeTriggerType]
  );

  const deleteNode = React.useCallback(
    (nodeId: string) => {
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNodeId((current) => (current === nodeId ? null : current));
    },
    [setEdges, setNodes]
  );

  const updateNodeConfig = React.useCallback(
    (nodeId: string, config: WorkflowNodeConfig) => {
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId) return node;
          const nextLabel =
            node.data.kind === "trigger" && isWorkflowTriggerType(config.triggerType)
              ? TRIGGER_META[config.triggerType].label
              : node.data.label;
          return { ...node, data: { ...node.data, label: nextLabel, config } };
        })
      );
    },
    [setNodes]
  );

  const onConnect = React.useCallback<OnConnect>(
    (connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      setEdges((current) =>
        addEdge({ ...connection, type: "smoothstep", animated: true }, current)
      );
    },
    [setEdges]
  );

  function openSettings() {
    setDraftName(workflowName || workflow?.name || "");
    setDraftDescription(workflowDescription);
    setSettingsOpen(true);
  }

  function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftName.trim()) {
      toast.error("Workflow name is required");
      return;
    }
    setWorkflowName(draftName.trim());
    setWorkflowDescription(draftDescription.trim());
    setSettingsOpen(false);
    toast.success("Details updated", { description: "Publish the workflow to save these changes." });
  }

  function handleStatusAction(action: StatusAction) {
    if (!workflow) return;
    if (action === "activate" && workflow.currentVersion === 0) {
      toast.error("Publish this workflow before activating it");
      return;
    }
    statusMutation.mutate(action);
  }

  if (!workflowId) {
    return (
      <EmptyState
        icon={WorkflowIcon}
        title="Workflow not found"
        description="The studio link is missing a workflow identifier."
        action={
          <Button asChild variant="gradient">
            <Link href="/automation">
              <ArrowLeft /> Back to workflows
            </Link>
          </Button>
        }
      />
    );
  }

  if (workflowQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-36 w-full rounded-3xl" />
        <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)_310px]">
          <Skeleton className="h-[620px] rounded-3xl" />
          <Skeleton className="h-[620px] rounded-3xl" />
          <Skeleton className="h-[620px] rounded-3xl" />
        </div>
      </div>
    );
  }

  if (workflowQuery.isError) {
    return (
      <div className="space-y-5">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/automation">
            <ArrowLeft /> Back to workflows
          </Link>
        </Button>
        <ErrorState
          title="We couldn't open this workflow"
          message="The workflow may have been removed, or you may not have access to it."
          onRetry={() => void workflowQuery.refetch()}
        />
      </div>
    );
  }

  if (!workflow) {
    return (
      <EmptyState
        icon={WorkflowIcon}
        title="Workflow not found"
        description="This workflow doesn't exist anymore or the link is no longer valid."
        action={
          <Button asChild variant="gradient">
            <Link href="/automation">
              <ArrowLeft /> Back to workflows
            </Link>
          </Button>
        }
      />
    );
  }

  const triggerMeta = TRIGGER_META[activeTriggerType] ?? TRIGGER_META.MANUAL;
  const TriggerIcon = triggerMeta.icon;
  const isActive = workflow.status === "ACTIVE";
  const isArchived = workflow.status === "ARCHIVED";
  const isPublished = workflow.currentVersion > 0;
  const publishing = publishMutation.isPending;
  const statusPending = statusMutation.isPending ? statusMutation.variables ?? null : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/automation">
            <ArrowLeft /> Back to workflows
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={openSettings}>
            <Settings2 /> Details
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
            <Play /> Test
          </Button>
          {!isArchived ? (
            isActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusAction("pause")}
                loading={statusPending === "pause"}
              >
                <Pause /> Pause
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusAction("activate")}
                loading={statusPending === "activate"}
                disabled={!isPublished}
                title={!isPublished ? "Publish this workflow before activating it" : undefined}
              >
                <Rocket /> Activate
              </Button>
            )
          ) : null}
          <Button
            variant="gradient"
            size="sm"
            onClick={() => publishMutation.mutate()}
            loading={publishing}
            disabled={nodes.length === 0}
          >
            <Sparkles /> Publish {isPublished ? `v${workflow.currentVersion + 1}` : "workflow"}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className={cn("h-1.5 w-full bg-gradient-to-r", triggerMeta.gradient)} />
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
                  triggerMeta.gradient
                )}
              >
                <TriggerIcon className="size-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                    {workflowName || workflow.name}
                  </h1>
                  <StatusBadge status={workflow.status} />
                  <Badge variant="purple" className="text-[10px] uppercase tracking-wide">
                    {isPublished ? `v${workflow.currentVersion}` : "Unpublished"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <TriggerIcon className="size-3.5" /> {triggerMeta.label}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" /> Updated {formatRelative(workflow.updatedAt)}
                  </span>
                  <span>Created {formatDate(workflow.createdAt)}</span>
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {workflowDescription.trim() ||
                    "No description yet. Use Details to explain what this journey should accomplish."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
              <div className="rounded-2xl border border-border/60 bg-secondary/30 px-3.5 py-2 text-right dark:border-white/[0.06] dark:bg-white/[0.03]">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Graph</p>
                <p className="mt-0.5 text-sm font-semibold">
                  {nodes.length} nodes · {edges.length} links
                </p>
              </div>
              {!isPublished ? (
                <p className="max-w-[210px] text-right text-[10px] leading-relaxed text-amber-600 dark:text-amber-300">
                  Publish the graph before activating or running a test.
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(value) => setTab(value as StudioTab)}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="design">
            <WorkflowIcon /> Designer
          </TabsTrigger>
          <TabsTrigger value="executions">
            <ListChecks /> Executions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="design">
          <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)_310px]">
            <NodePalette
              nodes={nodes}
              onAdd={addNode}
              className="xl:max-h-[calc(100dvh-20rem)] xl:overflow-y-auto"
            />

            <div className="h-[600px] min-h-[520px] xl:h-[calc(100dvh-20rem)] xl:min-h-[620px]">
              <WorkflowCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={setSelectedNodeId}
                onPaneClick={() => setSelectedNodeId(null)}
                fitKey={workflow.id}
              />
            </div>

            <NodeConfigPanel
              node={selectedNode}
              onConfigChange={updateNodeConfig}
              onDelete={deleteNode}
              onClose={() => setSelectedNodeId(null)}
              className="xl:max-h-[calc(100dvh-20rem)]"
            />
          </div>
        </TabsContent>

        <TabsContent value="executions">
          <ExecutionsPanel workflowId={workflow.id} nodeLabels={nodeLabels} />
        </TabsContent>
      </Tabs>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={saveSettings} className="space-y-5">
            <DialogHeader>
              <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-[0_12px_30px_-12px_rgba(124,58,237,0.8)]">
                <Pencil className="size-5" />
              </div>
              <DialogTitle>Workflow details</DialogTitle>
              <DialogDescription>
                Names and descriptions are saved to the workspace when you publish the graph.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="studio-name">Workflow name</Label>
                <Input
                  id="studio-name"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="Welcome & activation"
                  maxLength={200}
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="studio-description">Description</Label>
                <Textarea
                  id="studio-description"
                  value={draftDescription}
                  onChange={(event) => setDraftDescription(event.target.value)}
                  placeholder="What should this journey accomplish?"
                  className="min-h-[100px]"
                  maxLength={2000}
                />
              </div>
              <div className="rounded-2xl border border-border/60 bg-secondary/30 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.03]">
                The trigger event is configured on the trigger node in the inspector. Its settings are published along
                with the graph.
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gradient">
                Save details
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TestWorkflowDialog
        workflow={workflow}
        open={testOpen}
        onOpenChange={setTestOpen}
        onTested={() => setTab("executions")}
      />
    </div>
  );
}
