"use client";

import { History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Template } from "@/lib/types";
import { TemplateVersionsList } from "./template-versions-list";

export function TemplateVersionsDialog({
  open,
  onOpenChange,
  template
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow-glow">
              <History className="size-4" />
            </span>
            Version history
          </DialogTitle>
          <DialogDescription>
            Every saved revision of <span className="font-semibold text-foreground">{template.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <TemplateVersionsList templateId={template.id} enabled={open} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
