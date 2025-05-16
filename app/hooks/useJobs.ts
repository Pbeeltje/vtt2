// hooks/useJobs.ts
import { useState, useEffect } from 'react';
import { toast } from "@/components/ui/use-toast";

interface Job {
  JobId: number;
  Name: string;
  Description: string | null;
  Tier: number;
  CharacterId: number;
}

const initialJobFormState = {
  name: '',
  description: null,
  tier: 0,
};

export function useJobs(characterId: number) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [newJobName, setNewJobName] = useState('');
  const [editingJob, setEditingJob] = useState<number | null>(null); // JobId of the job being edited, or null
  const [jobForm, setJobForm] = useState<{ name: string; description: string | null; tier: number }>(initialJobFormState);

  useEffect(() => {
    const fetchJobs = async () => {
      if (typeof characterId !== 'number' || !Number.isInteger(characterId) || characterId <= 0) {
        setJobs([]);
        return;
      }

      try {
        const response = await fetch(`/api/characters/${characterId}/jobs`);

        if (!response.ok) {
          let errorResponseMessage = `Failed to fetch jobs: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorResponseMessage = errorData.error || errorData.message || errorResponseMessage;
          } catch (jsonError) {
          }
          throw new Error(errorResponseMessage);
        }

        const data: Job[] = await response.json();
        setJobs(data);
      } catch (error) {
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
  }, [characterId]);

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof characterId !== 'number' || characterId <= 0) {
      toast({ title: "Error", description: "Cannot add job: Invalid character identifier.", variant: "destructive" });
      return;
    }
    if (!newJobName) {
      toast({ title: "Error", description: "Job name is required.", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(`/api/characters/${characterId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newJobName, description: null, tier: 1 }),
      });
      if (!response.ok) throw new Error(`Failed to add job: ${response.statusText}`);
      const newJob: Job = await response.json();
      setJobs([...jobs, newJob]);
      setNewJobName('');
      toast({ title: "Job Added", description: `${newJob.Name} added successfully.` });
    } catch (error: any) {
      console.error("Error adding job:", error);
      toast({ title: "Error", description: "Failed to add job.", variant: "destructive" });
    }
  };

  const handleStartEditJob = (job: Job) => {
    setEditingJob(job.JobId);
    setJobForm({ name: job.Name, description: job.Description, tier: job.Tier });
  };

  const cancelEditMode = () => {
    setEditingJob(null);
    setJobForm(initialJobFormState);
  };

  const handleJobFormChange = (field: keyof typeof jobForm, value: string | number) => {
      setJobForm(prevForm => ({
        ...prevForm,
        [field]: field === 'tier' ? parseInt(value as string, 10) || 0 : value,
      }));
  };

  const handleJobSubmit = async (jobIdToUpdate?: number) => {
    const currentJobId = jobIdToUpdate ?? editingJob;
    if (typeof characterId !== 'number' || characterId <= 0) {
      toast({ title: "Error", description: "Cannot update job: Invalid character identifier.", variant: "destructive" });
      return;
    }
    if (!jobForm || currentJobId === null) {
        toast({ title: "Error", description: "No job selected for update or form is empty.", variant: "destructive" });
        return;
    }
    try {
      const response = await fetch(`/api/characters/${characterId}/jobs/${currentJobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobForm),
      });
      if (!response.ok) throw new Error(`Failed to update job: ${response.statusText}`);
      const updatedJob: Job = await response.json();
      setJobs(prevJobs => prevJobs.map(j => (j.JobId === updatedJob.JobId ? updatedJob : j)));
      cancelEditMode();
      toast({ title: "Job Updated", description: "Job saved successfully." });
    } catch (error: any) {
      console.error("Error updating job:", error);
      toast({ title: "Error", description: "Failed to update job.", variant: "destructive" });
    }
  };

  return { 
    jobs, 
    newJobName, 
    setNewJobName, 
    editingJob, // still need to expose this for conditional rendering in JobsTab
    jobForm, 
    handleAddJob, 
    handleStartEditJob, // expose renamed function
    cancelEditMode,     // expose new function
    handleJobFormChange, 
    handleJobSubmit 
  };
}