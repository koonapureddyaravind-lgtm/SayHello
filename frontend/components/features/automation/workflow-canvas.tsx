"use client";

import "@xyflow/react/dist/style.css";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useNodesInitialized,
  useReactFlow
} from "@xyflow/react";
import type { Edge, Node, NodeProps, OnConnect, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import { MousePointer2, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { WorkflowNodeType } from "@/lib/types";
import type { StudioNode, WorkflowNodeData } from "./studio-types";
import { NODE_META_BY_KIND, nodeSummary } from "./workflow-meta";

const MINIMAP_COLORS: Record<WorkflowNodeType, string> = {
  trigger: "#6366f1",
  send_email: "#0ea5e9",
  send_whatsapp: "#10b981",
  send_sms: "#f59e0b",
  wait: "#06b6d4",
  condition: "#d946ef",
  add_tag: "#8b5cf6",
  webhook: "#14b8a6",
  end: "#64748b"
};

function WorkflowNodeCard({ data, selected }: NodeProps<StudioNode>) {
  const meta = NODE_META_BY_KIND[data.kind] ?? NODE_META_BY_KIND.end;
  const Icon = meta.icon;
  const hasTarget = data.kind !== "trigger";
  const hasSource = data.kind !== "end";
  const isCondition = data.kind === "condition";

  return (
    <div
      className={cn(
        "group relative w-[238px] rounded-2xl border bg-card/95 text-card-foreground shadow-card backdrop-blur-xl transition-all duration-200",
        selected
          ? "border-violet-400 shadow-float ring-4 ring-violet-500/15 dark:border-violet-400/70"
          : "border-border/70 hover:-translate-y-0.5 hover:border-violet-300/70 hover:shadow-float dark:border-white/10 dark:hover:border-violet-400/40"
      )}
    >
      {hasTarget ? (
        <Handle
          type="target"
          position={Position.Top}
          style={{ width: 12, height: 12, background: "#8b5cf6", border: "2px solid hsl(var(--card))" }}
        />
      ) : null}

      <div className={cn("relative flex items-center gap-2.5 overflow-hidden rounded-t-2xl bg-gradient-to-r px-3.5 py-2.5 text-white", meta.gradient)}>
        <span className="pointer-events-none absolute -right-6 -top-8 size-20 rounded-full bg-white/20 blur-2xl" />
        <span className="relative flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/20">
          <Icon className="size-3.5" />
        </span>
        <div className="relative min-w-0 flex-1">
          <p className="truncate font-display text-xs font-semibold tracking-tight">{data.label}</p>
          <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-white/65">{meta.label}</p>
        </div>
      </div>

      <div className="px-3.5 py-3">
        <p className="truncate text-[11px] leading-relaxed text-muted-foreground">{nodeSummary(data.kind, data.config)}</p>
      </div>

      {isCondition ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Bottom}
            style={{ left: "32%", width: 11, height: 11, background: "#10b981", border: "2px solid hsl(var(--card))" }}
          />
          <Handle
            id="false"
            type="source"
            position={Position.Bottom}
            style={{ left: "68%", width: 11, height: 11, background: "#f43f5e", border: "2px solid hsl(var(--card))" }}
          />
          <span className="pointer-events-none absolute -bottom-[22px] left-[25%] rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
            True
          </span>
          <span className="pointer-events-none absolute -bottom-[22px] left-[62%] rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-300">
            False
          </span>
        </>
      ) : null}

      {hasSource && !isCondition ? (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ width: 12, height: 12, background: "#8b5cf6", border: "2px solid hsl(var(--card))" }}
        />
      ) : null}
    </div>
  );
}

const nodeTypes = { workflow: WorkflowNodeCard };

function FitViewOnLoad({ fitKey }: { fitKey: string }) {
  const nodesInitialized = useNodesInitialized();
  const { fitView, getNodes } = useReactFlow();
  const fittedKey = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!nodesInitialized || getNodes().length === 0 || fittedKey.current === fitKey) return;
    fittedKey.current = fitKey;
    void fitView({ padding: 0.35, maxZoom: 1 });
  }, [fitKey, fitView, getNodes, nodesInitialized]);

  return null;
}

export interface WorkflowCanvasProps {
  nodes: StudioNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<StudioNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeClick: (nodeId: string) => void;
  onPaneClick: () => void;
  fitKey?: string;
}

export function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  fitKey = "default"
}: WorkflowCanvasProps) {
  const nodeColor = React.useCallback((node: Node) => {
    const data = node.data as WorkflowNodeData;
    return MINIMAP_COLORS[data.kind] ?? "#8b5cf6";
  }, []);

  return (
    <div className="relative h-full min-h-[520px] w-full overflow-hidden rounded-3xl border border-border/70 bg-card/60 shadow-card dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="pointer-events-none absolute inset-0 aurora-layer opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-grid-fade bg-[length:26px_26px] opacity-25" />

      <div className="relative z-[1] h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_event, node) => onNodeClick(node.id)}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.35, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={1.6}
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: true
          }}
          proOptions={{ hideAttribution: true }}
          className="[&_.react-flow__pane]:cursor-grab [&_.react-flow__pane.dragging]:cursor-grabbing"
        >
          <FitViewOnLoad fitKey={fitKey} />
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} color="rgba(124,58,237,0.34)" />
          <Controls
            showInteractive={false}
            position="bottom-left"
            className="!m-3 !overflow-hidden !rounded-xl !border !border-border/70 !bg-card/90 !shadow-card"
          />
          <MiniMap
            pannable
            zoomable
            position="bottom-right"
            nodeColor={nodeColor}
            nodeStrokeWidth={3}
            nodeBorderRadius={6}
            bgColor="hsl(var(--card))"
            maskColor="rgba(17,10,38,0.12)"
            className="!m-3 !h-[92px] !w-[148px] !overflow-hidden !rounded-xl !border !border-border/70 !shadow-card"
          />

          <Panel position="top-left" className="!m-3">
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/85 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-[#140e26]/80">
              <span className="flex size-5 items-center justify-center rounded-md bg-brand-gradient text-white">
                <MousePointer2 className="size-3" />
              </span>
              <span>
                <span className="font-semibold text-foreground">{nodes.length}</span> nodes ·{" "}
                <span className="font-semibold text-foreground">{edges.length}</span> connections
              </span>
            </div>
          </Panel>

          <Panel position="top-right" className="!m-3 hidden sm:block">
            <div className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card/85 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-[#140e26]/80">
              <Trash2 className="size-3" />
              Select a node, then press Delete
            </div>
          </Panel>
        </ReactFlow>
      </div>

      <style jsx global>{`
        .react-flow__controls-button {
          width: 30px;
          height: 30px;
          background: hsl(var(--card));
          border-bottom: 1px solid hsl(var(--border));
          color: hsl(var(--foreground));
        }
        .react-flow__controls-button:hover {
          background: hsl(var(--secondary));
        }
        .react-flow__controls-button svg {
          fill: currentColor;
        }
        .react-flow__minimap {
          backdrop-filter: blur(12px);
        }
        .react-flow__edge-path {
          stroke: rgba(139, 92, 246, 0.62);
        }
        .dark .react-flow__edge-path {
          stroke: rgba(196, 181, 253, 0.55);
        }
        .react-flow__connection-path {
          stroke: #8b5cf6;
          stroke-width: 2;
        }
        .react-flow__node {
          font-family: inherit;
        }
        .react-flow__handle {
          transition: transform 0.15s ease;
        }
        .react-flow__handle:hover {
          transform: scale(1.25);
        }
      `}</style>
    </div>
  );
}
