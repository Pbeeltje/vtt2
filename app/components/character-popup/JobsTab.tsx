// components/character-popup/JobsTab.tsx
import { useState } from 'react';
import type { Job, JobFormPayload } from '../../hooks/useJobs';
import { Button } from "@/components/ui/button";
import { MarkdownContent } from '@/components/MarkdownContent';
import { FileText, Plus } from 'lucide-react';
import { JobDetailModal } from './JobDetailModal';

interface JobsTabProps {
  jobs: Job[];
  handleCreateJob: (form: JobFormPayload) => Promise<boolean>;
  handleJobSubmit: (jobId: number, form: JobFormPayload) => Promise<boolean>;
}

export function JobsTab({ jobs, handleCreateJob, handleJobSubmit }: JobsTabProps) {

  const [modalJob, setModalJob] = useState<Job | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openJobModal = (job: Job) => {
    setModalJob(job);
    setModalOpen(true);
  };

  const openNewJobModal = () => {
    setModalJob(null);
    setModalOpen(true);
  };

  const handleModalOpenChange = (open: boolean) => {
    setModalOpen(open);
    if (!open) setModalJob(null);
  };

  const modalJobLive =
    modalJob && modalOpen ? jobs.find((j) => j.JobId === modalJob.JobId) ?? modalJob : null;

  return (
    <div>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {jobs.length === 0 ? "No jobs yet." : `${jobs.length} job${jobs.length === 1 ? "" : "s"}`}
          </p>
          <Button type="button" size="sm" className="gap-1.5" onClick={openNewJobModal}>
            <Plus className="h-4 w-4" />
            Add job
          </Button>
        </div>

        {jobs.length > 0 ? (
          <ul className="space-y-4">
            {jobs.map((job) => (
              <li key={job.JobId} className="border p-4 rounded-lg">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{job.Name} (Tier {job.Tier})</span>
                    {job.Description?.trim() ? (
                      <div className="relative mt-2 max-h-[7.5rem] overflow-hidden text-muted-foreground">
                        <MarkdownContent markdown={job.Description} />
                        <div
                          className="pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-background to-transparent"
                          aria-hidden
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2 italic">No description</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 self-start"
                    onClick={() => openJobModal(job)}
                    title="Open full description and edit"
                  >
                    <FileText className="h-4 w-4" />
                    Details
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <JobDetailModal
        job={modalOpen ? (modalJob ? modalJobLive : null) : null}
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        onSave={handleJobSubmit}
        onCreate={handleCreateJob}
      />
    </div>
  );
}
