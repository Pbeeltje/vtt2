"use client"

import { useCallback, useRef, useState } from "react"
import type { Socket } from "socket.io-client"
import { toast } from "@/components/ui/use-toast"
import { toChatMessage, type ChatMessage } from "@/lib/chat-message"
import type { TestAttribute } from "@/lib/dice"
import { toPlainText } from "@/lib/chat-text"
import { api, errorMessage } from "../lib/api"
import type { LayerImage } from "../types/layerImage"
import { useSocketEvent } from "./useSocket"

const PAGE_SIZE = 100
const BALLOON_MS = 3000

export type Speaker = { name: string; type: "user" | "character" }

export interface TextBalloonData {
  id: string
  message: string
  characterName: string
  x: number
  y: number
  tokenWidth: number
  tokenHeight: number
  timestamp: number
}

/**
 * Chat history (paged), sending messages and server-side dice rolls, and the speech balloons
 * shown over a character's token when it speaks.
 */
export function useChat(socket: Socket | null, findToken: (characterName: string) => LayerImage | undefined, gridSize: number) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [textBalloons, setTextBalloons] = useState<TextBalloonData[]>([])
  const findTokenRef = useRef(findToken)
  findTokenRef.current = findToken
  const gridSizeRef = useRef(gridSize)
  gridSizeRef.current = gridSize
  // Messages arrive both in our own POST response and over the socket; keep the first.
  const seenIds = useRef(new Set<number>())

  // One balloon per character: a new line replaces the old one. Our own lines show the balloon
  // as soon as they're sent; the server's copy of the same line then leaves it alone.
  const showBalloon = useCallback((characterName: string, content: string) => {
    const token = findTokenRef.current(characterName)
    if (!token) return
    const id = `balloon-${characterName}`
    const message = toPlainText(content)
    const timestamp = Date.now()
    setTextBalloons((prev) => {
      const existing = prev.find((b) => b.id === id)
      if (existing?.message === message && timestamp - existing.timestamp < BALLOON_MS) return prev
      return [
        ...prev.filter((b) => b.id !== id),
        {
          id,
          message,
          characterName,
          x: token.x,
          y: token.y,
          tokenWidth: token.width || gridSizeRef.current,
          tokenHeight: token.height || gridSizeRef.current,
          timestamp,
        },
      ]
    })
    setTimeout(() => setTextBalloons((prev) => prev.filter((b) => b.id !== id || b.timestamp !== timestamp)), BALLOON_MS)
  }, [])

  const closeBalloon = useCallback((id: string) => setTextBalloons((prev) => prev.filter((b) => b.id !== id)), [])

  /** Adds a message unless we already have it. */
  const receive = useCallback(
    (message: ChatMessage) => {
      if (message.MessageId !== undefined) {
        if (seenIds.current.has(message.MessageId)) return
        seenIds.current.add(message.MessageId)
      }
      setMessages((prev) => [...prev, message])
      if (message.senderType === "character" && message.type === "user") showBalloon(message.username, message.content)
    },
    [showBalloon]
  )

  const remember = (list: ChatMessage[]) => {
    for (const m of list) if (m.MessageId !== undefined) seenIds.current.add(m.MessageId)
    return list
  }

  useSocketEvent<[Record<string, unknown>]>(socket, "new_message", (row) => receive(toChatMessage(row)))

  const loadLatest = useCallback(async () => {
    try {
      const rows = await api<Record<string, unknown>[]>(`/api/chat?limit=${PAGE_SIZE}`)
      seenIds.current.clear()
      setMessages(remember(rows.map(toChatMessage)))
      setHasMore(rows.length === PAGE_SIZE)
    } catch (error) {
      toast({ title: "Chat not loaded", description: errorMessage(error), variant: "destructive" })
    }
  }, [])

  const loadOlder = useCallback(async () => {
    const oldest = messages[0]?.MessageId
    if (!oldest) return
    try {
      const rows = await api<Record<string, unknown>[]>(`/api/chat?limit=${PAGE_SIZE}&before=${oldest}`)
      const older = remember(rows.map(toChatMessage))
      setMessages((prev) => [...older, ...prev])
      setHasMore(rows.length === PAGE_SIZE)
    } catch (error) {
      toast({ title: "Older messages not loaded", description: errorMessage(error), variant: "destructive" })
    }
  }, [messages])

  const sendMessage = useCallback(
    async (content: string, speaker: Speaker) => {
      if (speaker.type === "character") showBalloon(speaker.name, content)
      try {
        const row = await api<Record<string, unknown>>("/api/chat", {
          method: "POST",
          body: { type: "user", content, speakerName: speaker.name, senderType: speaker.type },
        })
        receive(toChatMessage(row))
      } catch (error) {
        if (speaker.type === "character") closeBalloon(`balloon-${speaker.name}`)
        toast({ title: "Message not sent", description: errorMessage(error), variant: "destructive" })
      }
    },
    [receive, showBalloon, closeBalloon]
  )

  /** Rolls on the server; the result arrives in chat for everyone. */
  const roll = useCallback(
    async (expression: string, options: { label?: string; speaker?: Speaker } = {}) => {
      try {
        const row = await api<Record<string, unknown>>("/api/roll", {
          method: "POST",
          body: {
            expression,
            label: options.label,
            speakerName: options.speaker?.name,
            senderType: options.speaker?.type,
          },
        })
        receive(toChatMessage(row))
      } catch (error) {
        toast({ title: "Roll failed", description: errorMessage(error), variant: "destructive" })
      }
    },
    [receive]
  )

  /** A d20 Test against the character's attribute score, checked on the server. */
  const rollTest = useCallback(
    async (characterId: number, attribute: TestAttribute) => {
      try {
        const row = await api<Record<string, unknown>>("/api/roll/test", { method: "POST", body: { characterId, attribute } })
        receive(toChatMessage(row))
      } catch (error) {
        toast({ title: "Roll failed", description: errorMessage(error), variant: "destructive" })
      }
    },
    [receive]
  )

  const reset = useCallback(() => {
    seenIds.current.clear()
    setMessages([])
    setHasMore(false)
    setTextBalloons([])
  }, [])

  return { messages, hasMore, loadLatest, loadOlder, sendMessage, roll, rollTest, reset, textBalloons, closeBalloon }
}
