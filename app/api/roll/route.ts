import { NextResponse } from "next/server"
import { getUserFromCookie } from "@/lib/auth"
import { postChatMessage, resolveSpeaker } from "@/lib/chat"
import { describeRoll, rollDice } from "@/lib/dice"
import { rateLimit } from "@/lib/rate-limit"

/**
 * Rolls a dice expression on the server and posts the result to chat as a diceRoll message.
 * Body: { expression: "2d6+1", label?: "Attack", speakerName?, senderType? }.
 */
export async function POST(req: Request) {
  const user = await getUserFromCookie()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (!rateLimit(`roll:user:${user.id}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: "Too many rolls; slow down a little" }, { status: 429 })
  }

  try {
    const { expression, label, speakerName, senderType } = await req.json()
    if (typeof expression !== "string") {
      return NextResponse.json({ error: "expression is required" }, { status: 400 })
    }
    if (label !== undefined && (typeof label !== "string" || label.length > 100)) {
      return NextResponse.json({ error: "label must be short text" }, { status: 400 })
    }
    const speaker = await resolveSpeaker(user, speakerName, senderType)
    if (typeof speaker === "string") {
      return NextResponse.json({ error: speaker }, { status: 403 })
    }

    let result
    try {
      result = rollDice(expression)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid dice expression" }, { status: 400 })
    }

    const message = await postChatMessage(user, speaker, "diceRoll", describeRoll(result, label?.trim() || undefined), result)
    return NextResponse.json(message)
  } catch (error) {
    console.error("Error rolling dice:", error)
    return NextResponse.json({ error: "Failed to roll" }, { status: 500 })
  }
}
