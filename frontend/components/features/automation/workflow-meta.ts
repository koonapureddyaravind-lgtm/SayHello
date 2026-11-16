import type { LucideIcon } from "lucide-react";
import {
  CircleStop,
  Clock3,
  GitBranch,
  Mail,
  MailOpen,
  MessageCircle,
  MousePointerClick,
  Play,
  Smartphone,
  Tag,
  UserPlus,
  UsersRound,
  Webhook,
  Zap
} from "lucide-react";
import type { WorkflowNodeConfig, WorkflowNodeType, WorkflowTriggerType } from "@/lib/types";
import { truncate } from "@/lib/format";

export interface TriggerMeta {
  label: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  chip: string;
  dot: string;
}

export const TRIGGER_META: Record<WorkflowTriggerType, TriggerMeta> = {
  CONTACT_CREATED: {
    label: "New contact",
    description: "Starts when a contact is created in this workspace.",
    icon: UserPlus,
    gradient: "from-indigo-500 via-violet-500 to-fuchsia-500",
    chip: "border-indigo-200/70 bg-indigo-100/80 text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-500/15 dark:text-indigo-200",
    dot: "bg-indigo-500"
  },
  CONTACT_TAG_ADDED: {
    label: "Tag added",
    description: "Starts when a contact receives a specific tag.",
    icon: Tag,
    gradient: "from-fuchsia-500 via-pink-500 to-rose-500",
    chip: "border-fuchsia-200/70 bg-fuchsia-100/80 text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/15 dark:text-fuchsia-200",
    dot: "bg-fuchsia-500"
  },
  SEGMENT_JOINED: {
    label: "Segment joined",
    description: "Starts when a contact enters a segment.",
    icon: UsersRound,
    gradient: "from-sky-500 via-blue-500 to-indigo-600",
    chip: "border-sky-200/70 bg-sky-100/80 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-200",
    dot: "bg-sky-500"
  },
  MESSAGE_OPENED: {
    label: "Message opened",
    description: "Starts when a contact opens an email.",
    icon: MailOpen,
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    chip: "border-amber-200/70 bg-amber-100/80 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-200",
    dot: "bg-amber-500"
  },
  MESSAGE_CLICKED: {
    label: "Link clicked",
    description: "Starts when a contact clicks a tracked link.",
    icon: MousePointerClick,
    gradient: "from-rose-500 via-pink-500 to-fuchsia-600",
    chip: "border-rose-200/70 bg-rose-100/80 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/15 dark:text-rose-200",
    dot: "bg-rose-500"
  },
  WEBHOOK: {
    label: "Inbound webhook",
    description: "Starts from a signed request to your webhook endpoint.",
    icon: Webhook,
    gradient: "from-teal-500 via-emerald-500 to-cyan-600",
    chip: "border-teal-200/70 bg-teal-100/80 text-teal-700 dark:border-teal-400/20 dark:bg-teal-500/15 dark:text-teal-200",
    dot: "bg-teal-500"
  },
  MANUAL: {
    label: "Manual",
    description: "Starts only when you run it from the studio.",
    icon: Play,
    gradient: "from-violet-500 via-purple-500 to-indigo-600",
    chip: "border-violet-200/70 bg-violet-100/80 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/15 dark:text-violet-200",
    dot: "bg-violet-500"
  }
};

export const TRIGGER_OPTIONS = (Object.keys(TRIGGER_META) as WorkflowTriggerType[]).map((value) => ({
  value,
  label: TRIGGER_META[value].label,
  description: TRIGGER_META[value].description
}));

export interface NodeMeta {
  kind: WorkflowNodeType;
  label: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
}

export const NODE_META_BY_KIND: Record<WorkflowNodeType, NodeMeta> = {
  trigger: {
    kind: "trigger",
    label: "Trigger",
    description: "Entry point for the journey",
    icon: Zap,
    gradient: "from-indigo-500 via-violet-500 to-fuchsia-500"
  },
  send_email: {
    kind: "send_email",
    label: "Send email",
    description: "Deliver an email via template or inline copy",
    icon: Mail,
    gradient: "from-sky-500 to-blue-600"
  },
  send_whatsapp: {
    kind: "send_whatsapp",
    label: "Send WhatsApp",
    description: "Message a contact on WhatsApp",
    icon: MessageCircle,
    gradient: "from-emerald-500 to-teal-600"
  },
  send_sms: {
    kind: "send_sms",
    label: "Send SMS",
    description: "Send a short text message",
    icon: Smartphone,
    gradient: "from-amber-400 to-orange-600"
  },
  wait: {
    kind: "wait",
    label: "Wait",
    description: "Pause the journey for a period of time",
    icon: Clock3,
    gradient: "from-cyan-500 to-sky-600"
  },
  condition: {
    kind: "condition",
    label: "Condition",
    description: "Branch on a contact attribute",
    icon: GitBranch,
    gradient: "from-fuchsia-500 to-pink-600"
  },
  add_tag: {
    kind: "add_tag",
    label: "Add tag",
    description: "Apply a tag to the contact",
    icon: Tag,
    gradient: "from-violet-500 to-purple-600"
  },
  webhook: {
    kind: "webhook",
    label: "Webhook",
    description: "Call an external endpoint",
    icon: Webhook,
    gradient: "from-teal-500 to-emerald-600"
  },
  end: {
    kind: "end",
    label: "End",
    description: "Finish the journey",
    icon: CircleStop,
    gradient: "from-slate-500 to-slate-700"
  }
};

export const NODE_PALETTE: NodeMeta[] = [
  NODE_META_BY_KIND.trigger,
  NODE_META_BY_KIND.send_email,
  NODE_META_BY_KIND.send_whatsapp,
  NODE_META_BY_KIND.send_sms,
  NODE_META_BY_KIND.wait,
  NODE_META_BY_KIND.condition,
  NODE_META_BY_KIND.add_tag,
  NODE_META_BY_KIND.webhook,
  NODE_META_BY_KIND.end
];

export const NODE_KINDS = Object.keys(NODE_META_BY_KIND) as WorkflowNodeType[];

export function isWorkflowNodeType(value: unknown): value is WorkflowNodeType {
  return typeof value === "string" && (NODE_KINDS as string[]).includes(value);
}

export function isWorkflowTriggerType(value: unknown): value is WorkflowTriggerType {
  return typeof value === "string" && value in TRIGGER_META;
}

export function configString(config: WorkflowNodeConfig, key: string): string {
  const value = config[key];
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

export function configNumber(config: WorkflowNodeConfig, key: string, fallback: number): number {
  const value = config[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function nodeSummary(kind: WorkflowNodeType, config: WorkflowNodeConfig): string {
  switch (kind) {
    case "trigger": {
      const raw = config.triggerType;
      return isWorkflowTriggerType(raw) ? TRIGGER_META[raw].label : "Choose a trigger";
    }
    case "send_email": {
      const subject = configString(config, "subject");
      if (subject) return truncate(subject, 44);
      if (configString(config, "templateId")) return "Using a saved template";
      if (configString(config, "body")) return truncate(configString(config, "body"), 44);
      return "Compose an email";
    }
    case "send_whatsapp":
    case "send_sms": {
      const body = configString(config, "body");
      return body ? truncate(body, 44) : "Write your message";
    }
    case "wait": {
      const amount = configNumber(config, "amount", 1);
      const unit = configString(config, "unit") || "HOURS";
      return `Wait ${amount} ${unit.toLowerCase()}`;
    }
    case "condition": {
      const field = configString(config, "field") || "contact field";
      const operator = configString(config, "operator") || "eq";
      const value = configString(config, "value");
      return value ? `${field} ${operator} ${truncate(value, 18)}` : `${field} ${operator}`;
    }
    case "add_tag": {
      const tag = configString(config, "tagName");
      return tag ? `Apply “${truncate(tag, 32)}”` : "Choose a tag";
    }
    case "webhook": {
      const url = configString(config, "url");
      return url ? truncate(url, 44) : "Add an endpoint URL";
    }
    case "end":
      return "Journey complete";
    default:
      return "Node";
  }
}
