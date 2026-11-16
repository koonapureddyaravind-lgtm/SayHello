import { Mail, MessageCircle, Smartphone } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Channel } from "@/lib/types";

const CHANNEL_STYLES: Record<Channel, { icon: typeof Mail; label: string; chip: string; dot: string; soft: string }> = {
  EMAIL: {
    icon: Mail,
    label: "Email",
    chip: "border-sky-200/70 bg-sky-100/80 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-200",
    dot: "bg-sky-500",
    soft: "from-sky-500 to-blue-600"
  },
  WHATSAPP: {
    icon: MessageCircle,
    label: "WhatsApp",
    chip: "border-emerald-200/70 bg-emerald-100/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-200",
    dot: "bg-emerald-500",
    soft: "from-emerald-500 to-teal-600"
  },
  SMS: {
    icon: Smartphone,
    label: "SMS",
    chip: "border-amber-200/70 bg-amber-100/80 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-200",
    dot: "bg-amber-500",
    soft: "from-amber-400 to-orange-600"
  }
};

export function ChannelBadge({ channel, className }: { channel: Channel; className?: string }) {
  const style = CHANNEL_STYLES[channel] ?? CHANNEL_STYLES.EMAIL;
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        style.chip,
        className
      )}
    >
      <Icon className="size-3" />
      {style.label}
    </span>
  );
}

export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  const style = CHANNEL_STYLES[channel] ?? CHANNEL_STYLES.EMAIL;
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "flex size-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
        style.soft,
        className
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export function channelMeta(channel: Channel) {
  return CHANNEL_STYLES[channel] ?? CHANNEL_STYLES.EMAIL;
}
