// The chat message shape used by the browser, mapped from chatmessage DB rows (as returned by
// GET/POST /api/chat, POST /api/roll and the `new_message` socket event).
import type { DiceRollResult } from "./dice"

export type MessageType = "user" | "system" | "diceRoll"

export interface ChatMessage {
  MessageId?: number
  type: string
  content: string
  timestamp: string
  username: string
  senderType?: "user" | "character"
  UserId?: number
  senderRole?: string
  /** For diceRoll messages: the structured result behind `content`. */
  roll?: DiceRollResult | null
}

export function toChatMessage(row: Record<string, unknown>): ChatMessage {
  let roll: DiceRollResult | null = null
  if (typeof row.Data === "string" && row.Data) {
    try {
      roll = JSON.parse(row.Data) as DiceRollResult
    } catch {
      roll = null
    }
  }
  return {
    MessageId: row.MessageId === undefined ? undefined : Number(row.MessageId),
    type: String(row.Type ?? "user"),
    content: String(row.Content ?? ""),
    timestamp: String(row.Timestamp ?? ""),
    username: String(row.Username ?? ""),
    senderType: row.SenderType === "character" ? "character" : "user",
    UserId: row.UserId === undefined ? undefined : Number(row.UserId),
    senderRole: row.SenderRole === undefined || row.SenderRole === null ? undefined : String(row.SenderRole),
    roll,
  }
}
