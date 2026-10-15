// app/api/characters/[id]/jobs/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseId } from "@/lib/api-errors"
import { requireCharacterAccess } from "@/lib/character-access"
import { parseJobBody, toJobRow } from "@/lib/jobs"

type Params = { params: Promise<{ id: string }> }

/** All jobs of a character. */
export async function GET(_req: Request, { params }: Params) {
  const charId = parseId((await params).id)
  const access = await requireCharacterAccess(charId)
  if (access instanceof NextResponse) return access
  try {
    const result = await db.execute({ sql: "SELECT * FROM job WHERE CharacterId = ? ORDER BY JobId", args: [charId] })
    return NextResponse.json(result.rows.map(toJobRow))
  } catch (error) {
    console.error("Error fetching jobs:", error)
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 })
  }
}

/** Adds a job to a character. */
export async function POST(req: Request, { params }: Params) {
  const charId = parseId((await params).id)
  const access = await requireCharacterAccess(charId)
  if (access instanceof NextResponse) return access
  try {
    const job = parseJobBody(await req.json().catch(() => null))
    if (typeof job === "string") return NextResponse.json({ error: job }, { status: 400 })
    const result = await db.execute({
      sql: "INSERT INTO job (CharacterId, Name, Tier, Description) VALUES (?, ?, ?, ?) RETURNING *",
      args: [charId, job.name, job.tier, job.description],
    })
    return NextResponse.json(toJobRow(result.rows[0]), { status: 201 })
  } catch (error) {
    console.error("Error creating job:", error)
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 })
  }
}
