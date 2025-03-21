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

export function useJobs(characterId: number) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [newJobName, setNewJobName] = useState('');
  const [editingJob, setEditingJob] = useState<number | null>(null);
  const [jobForm, setJobForm] = useState<{ name: string; description: string | null; tier: number }>({
    name: '',
    description: null,
    tier: 0,
  });

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await fetch(`/api/characters/${characterId}/jobs`);
        if (!response.ok) throw new Error(`Failed to fetch jobs: ${response.statusText}`);
        const data: Job[] = await response.json();
        setJobs(data);
      } catch (error: any) {
        console.error("Error fetching jobs:", error);
        toast({ title: "Error", description: "Failed to fetch jobs.", variant: "destructive" });
      }
    };
    fetchJobs();
  }, [characterId]);

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleJobEdit = (job: Job) => {
    setEditingJob(job.JobId);
    setJobForm({ name: job.Name, description: job.Description, tier: job.Tier });
  };

  const handleJobFormChange = (field: keyof typeof jobForm, value: string | number) => {
    if (jobForm) {
      setJobForm({
        ...jobForm,
        [field]: field === 'tier' ? parseInt(value as string) || 0 : value,
      });
    }
  };

  const handleJobSubmit = async (jobId: number) => {
    if (!jobForm) return;
    try {
      const response = await fetch(`/api/characters/${characterId}/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobForm),
      });
      if (!response.ok) throw new Error(`Failed to update job: ${response.statusText}`);
      const updatedJob: Job = await response.json();
      setJobs(prevJobs => prevJobs.map(j => (j.JobId === updatedJob.JobId ? updatedJob : j)));
      setEditingJob(null);
      setJobForm({ name: '', description: null, tier: 0 });
      toast({ title: "Job Updated", description: "Job saved successfully." });
    } catch (error: any) {
      console.error("Error updating job:", error);
      toast({ title: "Error", description: "Failed to update job.", variant: "destructive" });
    }
  };

  return { jobs, newJobName, setNewJobName, editingJob, jobForm, handleAddJob, handleJobEdit, handleJobFormChange, handleJobSubmit };
}