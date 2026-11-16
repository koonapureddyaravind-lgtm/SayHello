"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { displayName, initials } from "@/lib/format";
import type { Contact, Tag } from "@/lib/types";

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #4f46e5, #9333ea)",
  "linear-gradient(135deg, #d946ef, #ec4899)",
  "linear-gradient(135deg, #0ea5e9, #4f46e5)",
  "linear-gradient(135deg, #10b981, #0d9488)",
  "linear-gradient(135deg, #f59e0b, #f97316)",
  "linear-gradient(135deg, #8b5cf6, #d946ef)"
];

export function avatarGradient(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 10_007;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length] ?? AVATAR_GRADIENTS[0];
}

export function ContactAvatar({
  contact,
  className,
  fallbackClassName
}: {
  contact: Pick<Contact, "id" | "firstName" | "lastName" | "email">;
  className?: string;
  fallbackClassName?: string;
}) {
  const name = displayName(contact);
  return (
    <Avatar className={cn("size-10", className)} gradient={false}>
      <AvatarFallback
        className={cn("text-[11px] font-bold text-white", fallbackClassName)}
        style={{ backgroundImage: avatarGradient(contact.id || contact.email || name) }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

const DEFAULT_TAG_COLOR = "#7c3aed";

function hexToRgba(hex: string, alpha: number): string | null {
  const cleaned = hex.replace("#", "").trim();
  const expanded =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((char) => char + char)
          .join("")
      : cleaned;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function tagVisual(color: string | null | undefined): React.CSSProperties {
  const raw = color?.trim() || DEFAULT_TAG_COLOR;
  const background = hexToRgba(raw, 0.13);
  const border = hexToRgba(raw, 0.34);
  return {
    color: hexToRgba(raw, 1) ? raw : DEFAULT_TAG_COLOR,
    backgroundColor: background ?? "rgba(124, 58, 237, 0.12)",
    borderColor: border ?? "rgba(124, 58, 237, 0.32)"
  };
}

export function TagPill({
  tag,
  onRemove,
  className
}: {
  tag: Pick<Tag, "name" | "color">;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        className
      )}
      style={tagVisual(tag.color)}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">{tag.name}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="-mr-1 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
          aria-label={`Remove ${tag.name} tag`}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}
