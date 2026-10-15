// Server side of chat: who may speak as whom, and storing + broadcasting messages.
import { db } from "./db"
import { getIO, AUTHENTICATED_ROOM } from "./socket"
import type { SessionUser } from "./session-token"

export const CHAT_COLUMNS = "MessageId, Type, Content, Timestamp, Username, UserId, SenderType, SenderRole, Data"

export type Speaker = { speakerName: string; senderType: "user" | "character" }

/**
 * Players may speak as themselves or as a character they own; the DM may use any name.
 * Missing values default to the user's own name. Returns an error message when not allowed.
 */
export async function resolveSpeaker(user: SessionUser, speakerName: unknown, senderType: unknown): Promise<Speaker | string> {
  const type = senderType === undefined || senderType === null ? "user" : senderType
  if (type !== "user" && type !== "character") return "senderType must be user or character"
  const name = speakerName === undefined || speakerName === null || speakerName === "" ? user.username : speakerName
  if (typeof name !== "string" || name.length > 100) return "Invalid speaker name"

  if (user.role === "DM") return { speakerName: name, senderType: type }
  if (type === "user") {
    return name === user.username ? { speakerName: name, senderType: type } : "You can only speak as yourself or your characters"
  }
  const owned = await db.execute({
    sql: "SELECT 1 FROM character WHERE userId = ? AND Name = ? LIMIT 1",
    args: [user.id, name],
  })
  return owned.rows.length > 0 ? { speakerName: name, senderType: type } : "You can only speak as yourself or your characters"
}

/** Stores a message and sends it to every logged-in client. Returns the stored row. */
export async function postChatMessage(
  user: SessionUser,
  speaker: Speaker,
  type: string,
  content: string,
  data: unknown = null
): Promise<Record<string, unknown>> {
  const result = await db.execute({
    sql: `INSERT INTO chatmessage (Type, Content, Timestamp, Username, UserId, SenderType, SenderRole, Data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${CHAT_COLUMNS}`,
    args: [
      type,
      content,
      new Date().toISOString(),
      speaker.speakerName,
      user.id,
      speaker.senderType,
      user.role,
      data === null ? null : JSON.stringify(data),
    ],
  })
  const row = { ...result.rows[0] }
  try {
    getIO().to(AUTHENTICATED_ROOM).emit("new_message", row)
  } catch (error) {
    console.error("[chat] new_message emit failed:", error)
  }
  return row
}
