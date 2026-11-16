import type { LucideIcon } from "lucide-react";
import {
  Crown,
  Eye,
  Headset,
  Mail,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRound
} from "lucide-react";
import type { Channel } from "@/lib/types";
import { titleCase } from "@/lib/format";

export interface ChannelMeta {
  label: string;
  blurb: string;
  icon: LucideIcon;
  gradient: string;
  ring: string;
  orb: string;
  chip: string;
  accent: string;
}

export const CHANNEL_ORDER: Channel[] = ["EMAIL", "WHATSAPP", "SMS"];

export const CHANNEL_META: Record<Channel, ChannelMeta> = {
  EMAIL: {
    label: "Email",
    blurb: "Transactional and marketing email through your own sending infrastructure.",
    icon: Mail,
    gradient: "from-sky-500 via-blue-500 to-indigo-500",
    ring: "border-sky-200/70 dark:border-sky-400/20",
    orb: "bg-sky-400/25",
    chip: "border-sky-200/70 bg-sky-100/80 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-200",
    accent: "text-sky-600 dark:text-sky-300"
  },
  WHATSAPP: {
    label: "WhatsApp",
    blurb: "Cloud API messaging, template approvals and delivery callbacks in one place.",
    icon: MessageCircle,
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    ring: "border-emerald-200/70 dark:border-emerald-400/20",
    orb: "bg-emerald-400/25",
    chip: "border-emerald-200/70 bg-emerald-100/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-200",
    accent: "text-emerald-600 dark:text-emerald-300"
  },
  SMS: {
    label: "SMS",
    blurb: "Global and regional SMS routes with sender IDs and provider callbacks.",
    icon: Smartphone,
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    ring: "border-amber-200/70 dark:border-amber-400/20",
    orb: "bg-amber-400/25",
    chip: "border-amber-200/70 bg-amber-100/80 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-200",
    accent: "text-amber-600 dark:text-amber-300"
  }
};

export interface ProviderOption {
  value: string;
  label: string;
}

export const PROVIDER_OPTIONS: Record<Channel, ProviderOption[]> = {
  EMAIL: [
    { value: "SMTP", label: "SMTP" },
    { value: "SES", label: "Amazon SES" },
    { value: "LOG", label: "Log (development)" }
  ],
  WHATSAPP: [{ value: "META_CLOUD", label: "Meta Cloud API" }],
  SMS: [
    { value: "TWILIO", label: "Twilio" },
    { value: "GENERIC_HTTP", label: "Generic HTTP" },
    { value: "PLIVO", label: "Plivo" },
    { value: "DLT", label: "DLT" }
  ]
};

export const CREDENTIAL_PRESETS: Record<Channel, string[]> = {
  EMAIL: ["host", "port", "username", "password"],
  WHATSAPP: ["accessToken"],
  SMS: ["accountSid", "authToken", "apiKey"]
};

export const CONFIG_PRESETS: Record<Channel, string[]> = {
  // TLS mode is auto-detected from the port (465 => implicit TLS, 587 => STARTTLS),
  // but operators can force it with `ssl` / `starttls` booleans.
  EMAIL: ["starttls", "ssl", "sslTrust"],
  // For template sends fill templateName + templateLanguage and either the full
  // `templateComponents` JSON or the shorthand `templateParameters` string array.
  WHATSAPP: ["phoneNumberId", "apiVersion", "templateName", "templateLanguage", "templateComponents", "templateParameters"],
  SMS: ["url", "senderId"]
};

export function providerLabel(value: string): string {
  for (const options of Object.values(PROVIDER_OPTIONS)) {
    const match = options.find((option) => option.value === value);
    if (match) return match.label;
  }
  return titleCase(value.replace(/_/g, " "));
}

export function providerCode(value: string): string {
  return value.replace(/_/g, " ");
}

export interface RoleMeta {
  label: string;
  blurb: string;
  permissions: string[];
  icon: LucideIcon;
  chip: string;
  gradient: string;
  orb: string;
}

const FALLBACK_ROLE: RoleMeta = {
  label: "Member",
  blurb: "Custom workspace role.",
  permissions: [],
  icon: UserRound,
  chip: "border-border bg-secondary text-foreground/80",
  gradient: "from-slate-500 via-violet-500 to-fuchsia-500",
  orb: "bg-violet-400/25"
};

export const ROLE_META: Record<string, RoleMeta> = {
  OWNER: {
    label: "Owner",
    blurb: "Full control across billing, security and every workspace.",
    permissions: ["Billing & plan changes", "Transfer ownership", "Delete the workspace"],
    icon: Crown,
    chip: "border-amber-200/70 bg-amber-100/80 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-200",
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    orb: "bg-amber-400/25"
  },
  ADMIN: {
    label: "Admin",
    blurb: "Runs the workspace day to day, from people to integrations.",
    permissions: ["Manage members & roles", "Connect channels", "Edit workspace settings"],
    icon: ShieldCheck,
    chip: "border-violet-200/70 bg-violet-100/80 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/15 dark:text-violet-200",
    gradient: "from-indigo-500 via-violet-500 to-fuchsia-500",
    orb: "bg-violet-400/25"
  },
  MARKETING_MANAGER: {
    label: "Marketing Manager",
    blurb: "Plans the calendar and publishes campaigns across channels.",
    permissions: ["Create & publish campaigns", "Manage templates", "Build segments & workflows"],
    icon: Megaphone,
    chip: "border-fuchsia-200/70 bg-fuchsia-100/80 text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/15 dark:text-fuchsia-200",
    gradient: "from-fuchsia-500 via-pink-500 to-rose-500",
    orb: "bg-fuchsia-400/25"
  },
  CAMPAIGN_MANAGER: {
    label: "Campaign Manager",
    blurb: "Builds and schedules campaigns without workspace-wide controls.",
    permissions: ["Build campaigns", "Schedule sends", "Review performance"],
    icon: Sparkles,
    chip: "border-sky-200/70 bg-sky-100/80 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-200",
    gradient: "from-sky-500 via-cyan-500 to-teal-500",
    orb: "bg-sky-400/25"
  },
  AGENT: {
    label: "Agent",
    blurb: "Answers conversations and keeps customer records tidy.",
    permissions: ["Work the shared inbox", "Reply on any channel", "Update contacts"],
    icon: Headset,
    chip: "border-emerald-200/70 bg-emerald-100/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-200",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    orb: "bg-emerald-400/25"
  },
  VIEWER: {
    label: "Viewer",
    blurb: "Read-only access to reporting and campaign performance.",
    permissions: ["View analytics", "Browse campaigns", "Read audit history"],
    icon: Eye,
    chip: "border-border bg-secondary text-foreground/80",
    gradient: "from-slate-500 via-slate-600 to-slate-700",
    orb: "bg-slate-400/25"
  },
  AGENCY_OWNER: {
    label: "Agency Owner",
    blurb: "Manages client workspaces under an agency organization.",
    permissions: ["Manage client workspaces", "Invite workspace admins", "View agency billing"],
    icon: Crown,
    chip: "border-amber-200/70 bg-amber-100/80 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-200",
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    orb: "bg-amber-400/25"
  },
  PLATFORM_ADMIN: {
    label: "Platform Admin",
    blurb: "comGpt platform operator with cross-tenant visibility.",
    permissions: ["Platform diagnostics", "Cross-tenant support", "System configuration"],
    icon: ShieldCheck,
    chip: "border-rose-200/70 bg-rose-100/80 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/15 dark:text-rose-200",
    gradient: "from-rose-500 via-red-500 to-orange-500",
    orb: "bg-rose-400/25"
  }
};

export function roleMeta(role: string | null | undefined): RoleMeta {
  if (!role) return FALLBACK_ROLE;
  return ROLE_META[role] ?? { ...FALLBACK_ROLE, label: titleCase(role.replace(/_/g, " ")) };
}

export const INVITE_ROLES = ["ADMIN", "MARKETING_MANAGER", "CAMPAIGN_MANAGER", "AGENT", "VIEWER"] as const;

export const CHANGE_ROLES = [
  "OWNER",
  "ADMIN",
  "MARKETING_MANAGER",
  "CAMPAIGN_MANAGER",
  "AGENT",
  "VIEWER"
] as const;

export const ROLE_EXPLAINERS = ["OWNER", "ADMIN", "MARKETING_MANAGER", "AGENT"] as const;

export type OrganizationType = "BUSINESS" | "AGENCY" | "ENTERPRISE";

export const ORGANIZATION_TYPES: { value: OrganizationType; label: string; blurb: string }[] = [
  { value: "BUSINESS", label: "Business", blurb: "A single brand or company workspace." },
  { value: "AGENCY", label: "Agency", blurb: "Manages client workspaces beneath it." },
  { value: "ENTERPRISE", label: "Enterprise", blurb: "Larger organisation with advanced controls." }
];

export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONES: TimezoneOption[] = [
  { value: "UTC", label: "UTC — Coordinated Universal Time" },
  { value: "America/Los_Angeles", label: "Los Angeles — Pacific Time" },
  { value: "America/Denver", label: "Denver — Mountain Time" },
  { value: "America/Chicago", label: "Chicago — Central Time" },
  { value: "America/New_York", label: "New York — Eastern Time" },
  { value: "America/Sao_Paulo", label: "São Paulo — Brasília Time" },
  { value: "Europe/London", label: "London — Greenwich Mean Time" },
  { value: "Europe/Paris", label: "Paris — Central European Time" },
  { value: "Europe/Berlin", label: "Berlin — Central European Time" },
  { value: "Europe/Madrid", label: "Madrid — Central European Time" },
  { value: "Europe/Amsterdam", label: "Amsterdam — Central European Time" },
  { value: "Africa/Johannesburg", label: "Johannesburg — South Africa Time" },
  { value: "Asia/Dubai", label: "Dubai — Gulf Standard Time" },
  { value: "Asia/Karachi", label: "Karachi — Pakistan Standard Time" },
  { value: "Asia/Kolkata", label: "Kolkata — India Standard Time" },
  { value: "Asia/Singapore", label: "Singapore — Singapore Time" },
  { value: "Asia/Shanghai", label: "Shanghai — China Standard Time" },
  { value: "Asia/Tokyo", label: "Tokyo — Japan Standard Time" },
  { value: "Australia/Sydney", label: "Sydney — Australian Eastern Time" },
  { value: "Pacific/Auckland", label: "Auckland — New Zealand Time" }
];

export const AUDIT_ENTITY_TYPES = [
  "Campaign",
  "Contact",
  "Template",
  "Workflow",
  "Integration",
  "Member",
  "Organization",
  "Billing"
];
