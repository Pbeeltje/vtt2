import { NextResponse } from "next/server"
import { db } from "@/app/lib/db"
import { requireAuth } from "@/lib/auth"
import type { JournalNote } from "@/app/types/journal-note"

const MAX_CONTENT = 200_000
const MAX_TITLE = 500

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: idParam } = await params
    const id = parseInt(idParam, 10)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const existing = db.prepare(`SELECT * FROM journal_note WHERE Id = ?`).get(id) as JournalNote | undefined
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (existing.UserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data = (await request.json()) as { title?: unknown; content?: unknown }
    let title = existing.Title
    let content = existing.Content

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

    const now = new Date().toISOString()
    db.prepare(
      `UPDATE journal_note SET Title = ?, Content = ?, UpdatedAt = ? WHERE Id = ? AND UserId = ?`
    ).run(title, content, now, id, user.id)

    const row = db.prepare(`SELECT * FROM journal_note WHERE Id = ?`).get(id) as JournalNote
    return NextResponse.json(row)
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("PATCH /api/journal-notes/[id]:", error)
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: idParam } = await params
    const id = parseInt(idParam, 10)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const result = db.prepare(`DELETE FROM journal_note WHERE Id = ? AND UserId = ?`).run(id, user.id)
    if (result.changes === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("DELETE /api/journal-notes/[id]:", error)
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 })
  }
}
