import { NextResponse } from "next/server"
import { db as client } from "@/lib/db"
import bcrypt from "bcryptjs"
import { requireAuth } from "@/lib/auth"
import { getUserRowById, rowIsHostAdmin } from "@/lib/user-schema"
import { parseId } from "@/lib/api-errors"
import { disconnectUserSockets } from "@/lib/socket"


const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 200

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

  const userId = parseId((await params).id)
  if (!userId) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
  }

  let body: { newPassword?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""
  if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters` },
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
  // The new password ends the user's sessions (see credentialStamp); close their live sockets too.
  disconnectUserSockets(userId)

  return NextResponse.json({ ok: true })
}
