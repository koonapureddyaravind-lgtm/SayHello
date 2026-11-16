"use client";

import { Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChannelIcon, channelMeta } from "@/components/common/channel-badge";
import { cn } from "@/lib/cn";
import type { Channel, TemplateVariable } from "@/lib/types";
import { normalizeTemplateVariables } from "./template-utils";

export function TemplatePreviewPane({
  channel,
  subject,
  body,
  htmlBody,
  variables,
  values,
  onValuesChange,
  source = "local",
  className
}: {
  channel: Channel;
  subject: string;
  body: string;
  htmlBody?: string | null;
  variables: TemplateVariable[];
  values: Record<string, string>;
  onValuesChange?: (values: Record<string, string>) => void;
  source?: "local" | "server";
  className?: string;
}) {
  const meta = channelMeta(channel);
  const previewVariables = normalizeTemplateVariables(variables);

  return (
    <div className={cn("space-y-3", className)}>
      {previewVariables.length > 0 && onValuesChange ? (
        <div className="rounded-2xl border border-border/70 bg-secondary/25 p-3 dark:border-white/[0.08] dark:bg-white/[0.02]">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Preview variables</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {previewVariables.map((variable) => (
              <label key={variable.name} className="space-y-1">
                <span className="block text-[11px] font-medium text-muted-foreground">
                  {variable.label?.trim() || variable.name}
                  {variable.required ? <span className="text-rose-500"> *</span> : null}
                </span>
                <Input
                  value={values[variable.name] ?? ""}
                  onChange={(event) => onValuesChange({ ...values, [variable.name]: event.target.value })}
                  placeholder={variable.defaultValue || `{{${variable.name}}}`}
                  className="h-8 text-xs"
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {channel === "EMAIL" ? (
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-white shadow-card dark:border-white/[0.08]">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="flex items-center gap-2 text-slate-600">
              <Mail className="size-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Email preview</span>
            </span>
            <Badge variant={source === "server" ? "success" : "secondary"} className="text-[10px]">
              {source === "server" ? "Server rendered" : "Local preview"}
            </Badge>
          </div>
          <div className="bg-white p-5 text-slate-900">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Subject</p>
            <p className="mt-0.5 text-base font-semibold text-slate-900">{subject || "(No subject)"}</p>
            <div className="mt-4 border-t border-slate-100 pt-4">
              {htmlBody ? (
                <iframe
                  title="Email HTML preview"
                  sandbox=""
                  srcDoc={htmlBody}
                  className="h-[320px] w-full rounded-xl border border-slate-200 bg-white"
                />
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                  {body || "Your message body will appear here."}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[330px] rounded-[2.2rem] border-[6px] border-[#171026] bg-[#171026] p-2 shadow-float">
          <div className="overflow-hidden rounded-[1.7rem] bg-slate-100">
            <div
              className={cn(
                "flex items-center gap-2.5 px-4 py-3 text-white",
                channel === "WHATSAPP" ? "bg-emerald-600" : "bg-amber-500"
              )}
            >
              <ChannelIcon channel={channel} className="size-8 rounded-full bg-white/20 shadow-none" />
              <div>
                <p className="text-xs font-semibold">{meta.label}</p>
                <p className="text-[10px] text-white/70">Business account</p>
              </div>
              <Badge variant="outline" className="ml-auto border-white/30 bg-white/10 text-[9px] text-white">
                {source === "server" ? "Server" : "Local"}
              </Badge>
            </div>
            <div
              className={cn(
                "min-h-[300px] space-y-3 p-3",
                channel === "WHATSAPP" ? "bg-[#e5ddd5]" : "bg-[#fff7e6]"
              )}
            >
              <div className="mx-auto w-fit rounded-full bg-black/5 px-2 py-0.5 text-[9px] font-medium text-slate-500">
                Preview message
              </div>
              <div
                className={cn(
                  "ml-auto max-w-[92%] rounded-2xl rounded-tr-sm px-3 py-2 text-sm text-slate-800 shadow-sm",
                  channel === "WHATSAPP" ? "bg-[#dcf8c6]" : "bg-white"
                )}
              >
                <p className="whitespace-pre-wrap break-words leading-relaxed">
                  {body || "Your message body will appear here."}
                </p>
                <p className="mt-1 text-right text-[9px] text-slate-500">Preview</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
