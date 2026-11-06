// A character's jobs (free text for now; Phase 2 adds a job catalog).

export const MAX_JOB_TIER = 3

/** A job as /api/characters/[id]/jobs returns it. */
export interface Job {
  JobId: number
  CharacterId: number
  Name: string
  Tier: number
  Description: string | null
}

/** What creating or editing a job sends. */
export interface JobForm {
  name: string
  tier: number
  description: string | null
}
