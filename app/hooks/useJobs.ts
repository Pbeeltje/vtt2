// hooks/useJobs.ts
import { useState, useEffect } from 'react';
import { toast } from "@/components/ui/use-toast";

export interface Job {
  JobId: number;
  Name: string;
  Description: string | null;
  Tier: number;
  CharacterId: number;
}

export type JobFormPayload = { name: string; description: string | null; tier: number };

function rowToJob(row: Record<string, unknown>): Job {
  return {
    JobId: row.JobId as number,
    CharacterId: row.CharacterId as number,
    Name: (row.Name ?? row.name) as string,
    Tier: (row.Tier ?? row.tier ?? 0) as number,
    Description: (row.Description ?? row.description ?? null) as string | null,
  };
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

export function useJobs(characterId: number) {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    const ac = new AbortController();

    const fetchJobs = async () => {
      if (typeof characterId !== 'number' || !Number.isInteger(characterId) || characterId <= 0) {
        setJobs([]);
        return;
      }

      try {
        const response = await fetch(`/api/characters/${characterId}/jobs`, {
          signal: ac.signal,
        });

        if (!response.ok) {
          let errorResponseMessage = `Failed to fetch jobs: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorResponseMessage = errorData.error || errorData.message || errorResponseMessage;
          } catch {
            /* ignore */
          }
          throw new Error(errorResponseMessage);
        }

        const raw = await response.json();
        const data = (Array.isArray(raw) ? raw : []).map((row) =>
          rowToJob(row as Record<string, unknown>)
        );
        if (!ac.signal.aborted) setJobs(data);
      } catch (error) {
        if (ac.signal.aborted || isAbortError(error)) return;
        const catchedError = error instanceof Error ? error : new Error(String(error));
        toast({
          title: "Error Loading Jobs",
          description: catchedError.message || "An unexpected error occurred.",
          variant: "destructive"
        });
        setJobs([]);
      }
    };

    fetchJobs();
    return () => ac.abort();
  }, [characterId]);

  const handleCreateJob = async (form: JobFormPayload): Promise<boolean> => {
    if (typeof characterId !== 'number' || characterId <= 0) {
      toast({ title: "Error", description: "Cannot add job: Invalid character identifier.", variant: "destructive" });
      return false;
    }
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Error", description: "Job name is required.", variant: "destructive" });
      return false;
    }
    try {
      const response = await fetch(`/api/characters/${characterId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: form.description?.trim() ? form.description : null,
          tier: form.tier,
        }),
      });
      if (!response.ok) {
        let msg = `Failed to add job: ${response.status} ${response.statusText}`;
        try {
          const errBody = await response.json();
          msg = errBody.error || errBody.details || errBody.message || msg;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const row = await response.json();
      const newJob = rowToJob(row as Record<string, unknown>);
      setJobs((prev) => [...prev, newJob]);
      toast({ title: "Job Added", description: `${newJob.Name} added successfully.` });
      return true;
    } catch (error: unknown) {
      console.error("Error adding job:", error);
      const desc = error instanceof Error ? error.message : "Failed to add job.";
      toast({ title: "Error", description: desc, variant: "destructive" });
      return false;
    }
  };

  const handleJobSubmit = async (jobId: number, form: JobFormPayload): Promise<boolean> => {
    if (typeof characterId !== 'number' || characterId <= 0) {
      toast({ title: "Error", description: "Cannot update job: Invalid character identifier.", variant: "destructive" });
      return false;
    }
    try {
      const response = await fetch(`/api/characters/${characterId}/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description?.trim() ? form.description : null,
          tier: form.tier,
        }),
      });
      if (!response.ok) {
        let msg = `Failed to update job: ${response.status} ${response.statusText}`;
        try {
          const errBody = await response.json();
          msg = errBody.error || errBody.details || errBody.message || msg;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const row = await response.json();
      const updatedJob = rowToJob(row as Record<string, unknown>);
      setJobs((prevJobs) => prevJobs.map((j) => (j.JobId === updatedJob.JobId ? updatedJob : j)));
      toast({ title: "Job Updated", description: "Job saved successfully." });
      return true;
    } catch (error: unknown) {
      console.error("Error updating job:", error);
      const desc = error instanceof Error ? error.message : "Failed to update job.";
      toast({ title: "Error", description: desc, variant: "destructive" });
      return false;
    }
  };

  return {
    jobs,
    handleCreateJob,
    handleJobSubmit,
  };
}
