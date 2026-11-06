"use client"

import { useState } from "react"
import { FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarkdownContent } from "@/components/MarkdownContent"
import type { Job, JobForm } from "../../types/job"
import { JobDetailModal } from "./JobDetailModal"

interface JobsTabProps {
  jobs: Job[]
  onCreateJob: (form: JobForm) => Promise<boolean>
  onSaveJob: (jobId: number, form: JobForm) => Promise<boolean>
}

export function JobsTab({ jobs, onCreateJob, onSaveJob }: JobsTabProps) {
  // The open job by id (so it shows the latest saved version), "new" for the create form.
  const [open, setOpen] = useState<number | "new" | null>(null)
  const openJob = typeof open === "number" ? (jobs.find((j) => j.JobId === open) ?? null) : null

  return (
    <div>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--jade-muted)]">
            {jobs.length === 0 ? "No jobs yet." : `${jobs.length} job${jobs.length === 1 ? "" : "s"}`}
          </p>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => setOpen("new")}>
            <Plus className="h-4 w-4" />
            Add job
          </Button>
        </div>

        {jobs.length > 0 && (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li key={job.JobId} className="jade-inset p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-[var(--jade-ink-hi)]">{job.Name}</span>{" "}
                    <span className="text-[var(--jade-muted)]">Tier {job.Tier}</span>
                    {job.Description?.trim() ? (
                      <div className="mt-2 max-h-[7.5rem] overflow-hidden text-[var(--jade-muted)] [mask-image:linear-gradient(to_bottom,#000_5.25rem,transparent_7.5rem)]">
                        <MarkdownContent markdown={job.Description} />
                      </div>
                    ) : (
                      <p className="mt-2 text-sm italic text-[var(--jade-muted)]">No description</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 self-start"
                    onClick={() => setOpen(job.JobId)}
                    title="Open full description and edit"
                  >
                    <FileText className="h-4 w-4" />
                    Details
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <JobDetailModal
        job={openJob}
        open={open === "new" || openJob !== null}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        onSave={onSaveJob}
        onCreate={onCreateJob}
      />
    </div>
  )
}
