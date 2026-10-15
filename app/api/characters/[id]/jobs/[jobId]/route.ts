import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseId } from "@/lib/api-errors"
import { requireCharacterAccess } from "@/lib/character-access"
import { parseJobBody, toJobRow } from "@/lib/jobs"

type Params = { params: Promise<{ id: string; jobId: string }> }

async function jobParams(params: Params["params"]) {
  const { id, jobId } = await params
  return { characterId: parseId(id), jobId: parseId(jobId) }
}

export async function PUT(request: Request, { params }: Params) {
  const { characterId, jobId } = await jobParams(params)
  const access = await requireCharacterAccess(characterId)
  if (access instanceof NextResponse) return access
  if (!jobId) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })

  try {
    const job = parseJobBody(await request.json().catch(() => null))
    if (typeof job === "string") return NextResponse.json({ error: job }, { status: 400 })
    const result = await db.execute({
      sql: "UPDATE job SET Name = ?, Description = ?, Tier = ? WHERE JobId = ? AND CharacterId = ? RETURNING *",
      args: [job.name, job.description, job.tier, jobId, characterId],
    })
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }
    return NextResponse.json(toJobRow(result.rows[0]))
  } catch (error) {
    console.error("Error updating job:", error)
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { characterId, jobId } = await jobParams(params)
  const access = await requireCharacterAccess(characterId)
  if (access instanceof NextResponse) return access
  if (!jobId) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })

  try {
    const result = await db.execute({
      sql: "DELETE FROM job WHERE JobId = ? AND CharacterId = ?",
      args: [jobId, characterId],
    })
    if (result.rowsAffected === 0) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting job:", error)
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 })
  }
}
