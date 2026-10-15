import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromCookie } from "@/lib/auth"
import { CHAT_COLUMNS, postChatMessage, resolveSpeaker } from "@/lib/chat"
import { rateLimit } from "@/lib/rate-limit"

const DEFAULT_PAGE = 100
const MAX_PAGE = 500

/**
 * The newest chat messages, oldest first. `?before=<MessageId>` pages back through history;
 * `?limit=` sets the page size (a page shorter than the limit means there is no more).
 */
export async function GET(req: Request) {
  const user = await getUserFromCookie()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const limitParam = Number(searchParams.get("limit") ?? DEFAULT_PAGE)
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_PAGE) : DEFAULT_PAGE
    const before = Number(searchParams.get("before"))
    const result = Number.isInteger(before) && before > 0
      ? await db.execute({
          sql: `SELECT ${CHAT_COLUMNS} FROM chatmessage WHERE MessageId < ? ORDER BY MessageId DESC LIMIT ?`,
          args: [before, limit],
        })
      : await db.execute({ sql: `SELECT ${CHAT_COLUMNS} FROM chatmessage ORDER BY MessageId DESC LIMIT ?`, args: [limit] })
    return NextResponse.json(result.rows.map((row) => ({ ...row })).reverse())
  } catch (error) {
    console.error("Error fetching chat messages:", error)
    return NextResponse.json({ error: "Failed to fetch chat messages" }, { status: 500 })
  }
}

/** Posts a text message. Dice rolls go through POST /api/roll so the server rolls them. */
export async function POST(req: Request) {
  const user = await getUserFromCookie()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  if (!rateLimit(`chat:user:${user.id}`, 30, 30 * 1000)) {
    return NextResponse.json({ error: "You're sending messages too fast" }, { status: 429 })
  }

  try {
    const { type, content, speakerName, senderType } = await req.json()
    if (type !== "user" && !(type === "system" && user.role === "DM")) {
      return NextResponse.json({ error: "type must be user (or system, for the DM)" }, { status: 400 })
    }
    if (typeof content !== "string" || !content.trim() || content.length > 2000) {
      return NextResponse.json({ error: "Message is empty or too long" }, { status: 400 })
    }
    const speaker = await resolveSpeaker(user, speakerName, senderType)
    if (typeof speaker === "string") {
      return NextResponse.json({ error: speaker }, { status: 403 })
    }

    return NextResponse.json(await postChatMessage(user, speaker, type, content))
  } catch (error) {
    console.error("Error saving chat message:", error)
    return NextResponse.json({ error: "Failed to save chat message" }, { status: 500 })
  }
}
