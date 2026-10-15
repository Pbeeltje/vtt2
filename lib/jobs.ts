// A character's jobs (free-text for now; Phase 2 adds a job catalog).

export interface JobRow {
  JobId: number
  CharacterId: number
  Name: string
  Tier: number
  Description: string | null
}

export const MAX_JOB_TIER = 3

export function toJobRow(row: Record<string, unknown>): JobRow {
  return {
    JobId: Number(row.JobId),
    CharacterId: Number(row.CharacterId),
    Name: String(row.Name ?? ""),
    Tier: Number(row.Tier ?? 1),
    Description: row.Description === null || row.Description === undefined ? null : String(row.Description),
  }
}

/** Validates a job create/update body ({ name, tier, description }); returns an error message on failure. */
export function parseJobBody(body: unknown): { name: string; tier: number; description: string | null } | string {
  if (!body || typeof body !== "object") return "Invalid job data"
  const b = body as Record<string, unknown>
  const name = typeof b.name === "string" ? b.name.trim() : ""
  if (!name || name.length > 100) return "Job name is required (at most 100 characters)"
  const tier = typeof b.tier === "string" ? Number(b.tier) : b.tier === undefined ? 1 : b.tier
  if (typeof tier !== "number" || !Number.isInteger(tier) || tier < 1 || tier > MAX_JOB_TIER) {
    return `Tier must be a whole number from 1 to ${MAX_JOB_TIER}`
  }
  const description = b.description === undefined || b.description === null ? null : b.description
  if (description !== null && (typeof description !== "string" || description.length > 20_000)) {
    return "Description must be text"
  }
  return { name, tier, description: description?.trim() ? description : null }
}
