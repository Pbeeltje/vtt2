import { NextResponse } from "next/server"
import { db } from "@/app/lib/db"
import { requireAuth } from "@/lib/auth"
import type { JournalNote } from "@/app/types/journal-note"

const MAX_CONTENT = 200_000
const MAX_TITLE = 500

export async function GET() {
  try {
    const user = await requireAuth()
    const stmt = db.prepare(
      `SELECT * FROM journal_note WHERE UserId = ? ORDER BY datetime(UpdatedAt) DESC`
    )
    const rows = stmt.all(user.id) as JournalNote[]
    return NextResponse.json(rows)
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
    const insert = db.prepare(
      `INSERT INTO journal_note (UserId, Title, Content, UpdatedAt, CreatedAt) VALUES (?, ?, ?, ?, ?)`
    )
    const result = insert.run(user.id, title, content, now, now)
    const id = Number(result.lastInsertRowid)
    const row = db.prepare(`SELECT * FROM journal_note WHERE Id = ?`).get(id) as JournalNote
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("POST /api/journal-notes:", error)
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 })
  }
}
