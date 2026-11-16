import type { Node } from "@xyflow/react";
import type { WorkflowNodeConfig, WorkflowNodeType } from "@/lib/types";

export type WorkflowNodeData = {
  label: string;
  kind: WorkflowNodeType;
  config: WorkflowNodeConfig;
  [key: string]: unknown;
};

/** React Flow node carrying our workflow node data. */
export type StudioNode = Node<WorkflowNodeData, "workflow">;
