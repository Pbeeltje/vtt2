"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { api, errorMessage } from "../lib/api"
import type { Job, JobForm } from "../types/job"

/** Trims the form for sending: a blank description is no description. */
const jobBody = (form: JobForm): JobForm => ({
  name: form.name.trim(),
  tier: form.tier,
  description: form.description?.trim() ? form.description : null,
})

/** A character's jobs, loaded when the character changes, with create and save. */
export function useJobs(characterId: number) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  // A save that finishes after switching characters must not land in the new one's list.
  const currentId = useRef(characterId)
  currentId.current = characterId

  useEffect(() => {
    setJobs([])
    if (!characterId) {
      setLoading(false)
      return
    }
    setLoading(true)
    let cancelled = false
    api<Job[]>(`/api/characters/${characterId}/jobs`)
      .then((list) => !cancelled && setJobs(list))
      .catch((error) => !cancelled && toast({ title: "Couldn't load jobs", description: errorMessage(error), variant: "destructive" }))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [characterId])

  /** Resolves false (after telling the user) if it failed. */
  const createJob = useCallback(
    async (form: JobForm): Promise<boolean> => {
      try {
        const job = await api<Job>(`/api/characters/${characterId}/jobs`, { method: "POST", body: jobBody(form) })
        if (currentId.current === characterId) setJobs((prev) => [...prev, job])
        toast({ title: "Job added", description: `${job.Name} added.` })
        return true
      } catch (error) {
        toast({ title: "Couldn't add the job", description: errorMessage(error), variant: "destructive" })
        return false
      }
    },
    [characterId]
  )

  /** Resolves false (after telling the user) if it failed. */
  const saveJob = useCallback(
    async (jobId: number, form: JobForm): Promise<boolean> => {
      try {
        const job = await api<Job>(`/api/characters/${characterId}/jobs/${jobId}`, { method: "PUT", body: jobBody(form) })
        if (currentId.current === characterId) setJobs((prev) => prev.map((j) => (j.JobId === job.JobId ? job : j)))
        toast({ title: "Job saved", description: `${job.Name} saved.` })
        return true
      } catch (error) {
        toast({ title: "Couldn't save the job", description: errorMessage(error), variant: "destructive" })
        return false
      }
    },
    [characterId]
  )

  return { jobs, loading, createJob, saveJob }
}
