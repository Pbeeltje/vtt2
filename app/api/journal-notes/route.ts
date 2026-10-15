import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { toJournalNote } from "@/app/types/journal-note"
import { rateLimit } from "@/lib/rate-limit"

const MAX_CONTENT = 200_000
const MAX_TITLE = 500
/** Plenty for a campaign; stops a runaway client from filling the database. */
const MAX_NOTES_PER_USER = 1000

export async function GET() {
  try {
    const user = await requireAuth()
    const result = await db.execute({
      sql: `SELECT * FROM journal_note WHERE UserId = ? ORDER BY datetime(UpdatedAt) DESC`,
      args: [user.id],
    })
    return NextResponse.json(result.rows.map(toJournalNote))
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("GET /api/journal-notes:", error)
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    if (!rateLimit(`journal:user:${user.id}`, 30, 60 * 1000)) {
      return NextResponse.json({ error: "Too many new notes; slow down" }, { status: 429 })
    }
    const count = await db.execute({ sql: "SELECT COUNT(*) AS n FROM journal_note WHERE UserId = ?", args: [user.id] })
    if (Number(count.rows[0]?.n ?? 0) >= MAX_NOTES_PER_USER) {
      return NextResponse.json({ error: `You have ${MAX_NOTES_PER_USER} notes; delete some first` }, { status: 400 })
    }
    let title = ""
    let content = ""
    try {
      const data = (await request.json()) as { title?: unknown; content?: unknown }
      if (data.title !== undefined) {
        if (typeof data.title !== "string") {
          return NextResponse.json({ error: "title must be a string" }, { status: 400 })
        }
        title = data.title.trim().slice(0, MAX_TITLE)
      }
      if (data.content !== undefined) {
        if (typeof data.content !== "string") {
          return NextResponse.json({ error: "content must be a string" }, { status: 400 })
        }
        content = data.content.slice(0, MAX_CONTENT)
      }
    } catch {
      /* empty body ok */
    }

    const now = new Date().toISOString()
    const result = await db.execute({
      sql: `INSERT INTO journal_note (UserId, Title, Content, UpdatedAt, CreatedAt) VALUES (?, ?, ?, ?, ?) RETURNING *`,
      args: [user.id, title, content, now, now],
    })
    return NextResponse.json(toJournalNote(result.rows[0]), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("POST /api/journal-notes:", error)
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 })
  }
}
