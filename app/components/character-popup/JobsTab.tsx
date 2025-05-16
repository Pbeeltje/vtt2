// components/character-popup/JobsTab.tsx
import { useJobs } from '../../hooks/useJobs';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit2 } from 'lucide-react';

interface JobsTabProps {
  characterId: number;
}

export function JobsTab({ characterId }: JobsTabProps) {
  const { 
    jobs, 
    newJobName, 
    setNewJobName, 
    editingJob, 
    jobForm, 
    handleAddJob, 
    handleStartEditJob,
    cancelEditMode,
    handleJobFormChange, 
    handleJobSubmit 
  } = useJobs(characterId);

  return (
    <div className="min-h-[500px]">
      <div className="space-y-4">
        {jobs.length > 0 ? (
          <ul className="space-y-4">
            {jobs.map((job) => (
              <li key={job.JobId} className="border p-4 rounded-lg">
                {editingJob === job.JobId ? (
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor={`job-name-${job.JobId}`}>Name</Label>
                      <Input id={`job-name-${job.JobId}`} value={jobForm?.name || ''} onChange={(e) => handleJobFormChange('name', e.target.value)} className="w-full max-w-xs" autoFocus />
                    </div>
                    <div>
                      <Label htmlFor={`job-tier-${job.JobId}`}>Tier</Label>
                      <Input id={`job-tier-${job.JobId}`} type="number" value={jobForm?.tier || 0} onChange={(e) => handleJobFormChange('tier', e.target.value)} className="w-16" min={0} />
                    </div>
                    <div>
                      <Label htmlFor={`job-desc-${job.JobId}`}>Description</Label>
                      <Textarea id={`job-desc-${job.JobId}`} value={jobForm?.description || ''} onChange={(e) => handleJobFormChange('description', e.target.value)} className="w-full min-h-[100px]" />
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" onClick={() => handleJobSubmit()}>Save</Button>
                      <Button size="sm" variant="outline" onClick={cancelEditMode}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">{job.Name} (Tier {job.Tier})</span>
                      <p className="text-sm text-muted-foreground mt-1">{job.Description || 'No description provided'}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleStartEditJob(job)} className="ml-2"><Edit2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>Jobless..</p>
        )}
        <form onSubmit={handleAddJob} className="mt-4">
          <div className="flex items-center space-x-2">
            <Input type="text" placeholder="New Job Name" value={newJobName} onChange={(e) => setNewJobName(e.target.value)} className="w-full max-w-xs" />
            <Button type="submit" size="sm">Add Job</Button>
          </div>
        </form>
      </div>
    </div>
  );
}