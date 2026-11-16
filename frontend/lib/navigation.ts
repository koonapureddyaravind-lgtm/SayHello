import type { LucideIcon } from "lucide-react";
import {
  ChartNoAxesCombined,
  CreditCard,
  FileText,
  Filter,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Plug,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  Workflow
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined }
    ]
  },
  {
    label: "Engage",
    items: [
      { label: "Contacts", href: "/contacts", icon: Users },
      { label: "Segments", href: "/segments", icon: Filter },
      { label: "Templates", href: "/templates", icon: FileText },
      { label: "Campaigns", href: "/campaigns", icon: Megaphone }
    ]
  },
  {
    label: "Automate",
    items: [
      { label: "Workflows", href: "/automation", icon: Workflow },
      { label: "Inbox", href: "/inbox", icon: MessageSquare },
      { label: "Consent", href: "/consent", icon: ShieldCheck }
    ]
  },
  {
    label: "Workspace",
    items: [
      { label: "Integrations", href: "/integrations", icon: Plug },
      { label: "Billing", href: "/billing", icon: CreditCard },
      { label: "Team", href: "/team", icon: UsersRound },
      { label: "Audit log", href: "/audit", icon: ScrollText },
      { label: "Settings", href: "/settings", icon: Settings }
    ]
  }
];

export const quickActions: NavItem[] = [
  { label: "New campaign", href: "/campaigns?create=1", icon: Megaphone },
  { label: "Add contact", href: "/contacts?create=1", icon: Users },
  { label: "New template", href: "/templates?create=1", icon: FileText },
  { label: "New workflow", href: "/automation?create=1", icon: Workflow }
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
