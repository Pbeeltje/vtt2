import { NextResponse } from "next/server"
import { db as client } from "@/lib/db"
import bcrypt from "bcryptjs"
import { requireAuth } from "@/lib/auth"
import { getUserRowById, rowIsHostAdmin } from "@/lib/user-schema"


const MIN_PASSWORD_LENGTH = 8

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let actor
  try {
    actor = await requireAuth("DM")
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "Authentication required") {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }
      if (e.message === "Insufficient permissions") {
        return NextResponse.json({ error: "DM only" }, { status: 403 })
      }
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const userId = parseInt((await params).id, 10)
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
  }

  let body: { newPassword?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 }
    )
  }

  const targetRow = await getUserRowById(client, userId)
  if (!targetRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Delegated DMs may reset player passwords only; DM and host accounts need the host.
  if (targetRow.Role === "DM" || rowIsHostAdmin(targetRow)) {
    const actorRow = await getUserRowById(client, actor.id)
    if (!actorRow || !rowIsHostAdmin(actorRow)) {
      return NextResponse.json({ error: "Only the host can reset a DM's password." }, { status: 403 })
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await client.execute({
    sql: "UPDATE User SET Password = ? WHERE UserId = ?",
    args: [hashedPassword, userId],
  })

  return NextResponse.json({ ok: true })
}
