"use client";

import { useState, useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownContent } from "@/components/MarkdownContent";
import type { Job, JobFormPayload } from "../../hooks/useJobs";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type JobDetailModalProps = {
  /** `null` when creating a new job */
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (jobId: number, form: JobFormPayload) => Promise<boolean>;
  onCreate: (form: JobFormPayload) => Promise<boolean>;
};

export function JobDetailModal({ job, open, onOpenChange, onSave, onCreate }: JobDetailModalProps) {
  const isCreate = open && job === null;

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<JobFormPayload>({
    name: "",
    description: null,
    tier: 1,
  });
  const [saving, setSaving] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragPointer = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (open) {
      setDragOffset({ x: 0, y: 0 });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (job) {
      setDraft({
        name: job.Name,
        description: job.Description,
        tier: job.Tier,
      });
      setIsEditing(false);
    } else {
      setDraft({ name: "", description: null, tier: 1 });
      setIsEditing(true);
    }
  }, [open, job?.JobId, job?.Name, job?.Description, job?.Tier]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragPointer.current = {
      px: e.clientX,
      py: e.clientY,
      ox: dragOffset.x,
      oy: dragOffset.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragPointer.current) return;
    setDragOffset({
      x: dragPointer.current.ox + (e.clientX - dragPointer.current.px),
      y: dragPointer.current.oy + (e.clientY - dragPointer.current.py),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragPointer.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    let ok: boolean;
    if (isCreate) {
      ok = await onCreate(draft);
      if (ok) onOpenChange(false);
    } else if (job) {
      ok = await onSave(job.JobId, draft);
      if (ok) setIsEditing(false);
    } else {
      ok = false;
    }
    setSaving(false);
  };

  const handleCancelEdit = () => {
    if (isCreate) {
      onOpenChange(false);
      return;
    }
    if (!job) return;
    setDraft({
      name: job.Name,
      description: job.Description,
      tier: job.Tier,
    });
    setIsEditing(false);
  };

  const showEditForm = isCreate || isEditing;

  const headerTitle = isCreate ? (
    <span className="text-muted-foreground">New job</span>
  ) : job ? (
    isEditing ? (
      <span className="text-muted-foreground">Edit job</span>
    ) : (
      <span>
        {job.Name} <span className="font-normal text-muted-foreground">(Tier {job.Tier})</span>
      </span>
    )
  ) : (
    "Job"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[200]" />
        <DialogPrimitive.Content
          className={cn(
            "flex max-h-[85vh] w-[50vw] min-w-[min(100%,18rem)] max-w-[min(50vw,56rem)] flex-col gap-0 overflow-hidden p-0",
            "fixed left-1/2 top-1/2 z-[210] translate-x-0 translate-y-0 border bg-background shadow-lg outline-none",
            "data-[state=open]:animate-none data-[state=closed]:animate-none"
          )}
          style={{
            transform: `translate(calc(-50% + ${dragOffset.x}px), calc(-50% + ${dragOffset.y}px))`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DialogHeader
            className={cn(
              "flex shrink-0 flex-row items-center justify-between space-y-0 border-b px-4 py-3 text-left",
              "cursor-grab touch-none select-none active:cursor-grabbing bg-muted/50"
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <DialogTitle className="pr-8 text-base font-semibold leading-tight">{headerTitle}</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onOpenChange(false)}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {showEditForm ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="job-modal-name">Name</Label>
                  <Input
                    id="job-modal-name"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    className="mt-1 max-w-md"
                    autoFocus={isCreate}
                    placeholder="Job name"
                  />
                </div>
                <div>
                  <Label htmlFor="job-modal-tier">Tier</Label>
                  <Input
                    id="job-modal-tier"
                    type="number"
                    min={0}
                    value={draft.tier}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        tier: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="mt-1 w-24"
                  />
                </div>
                <div>
                  <Label htmlFor="job-modal-desc">Description (markdown)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                    **bold**, lists, links, `code`, headings…
                  </p>
                  <Textarea
                    id="job-modal-desc"
                    value={draft.description ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        description: e.target.value || null,
                      }))
                    }
                    className="mt-1 min-h-[220px] w-full font-mono text-sm"
                    placeholder="Optional — supports markdown"
                  />
                </div>
              </div>
            ) : job ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{job.Name}</span> — Tier {job.Tier}
                </p>
                {job.Description?.trim() ? (
                  <MarkdownContent markdown={job.Description} className="text-foreground" />
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description yet.</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
            {isCreate ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={handleSave} disabled={saving || !draft.name.trim()}>
                  {saving ? "Creating…" : "Create job"}
                </Button>
              </>
            ) : showEditForm ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={handleSave} disabled={saving || !draft.name.trim()}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </>
            ) : job ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button type="button" size="sm" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              </>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
