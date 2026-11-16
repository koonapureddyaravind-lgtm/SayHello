"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => void copy()} aria-label={label}>
      {copied ? <Check className="text-emerald-500" /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}
