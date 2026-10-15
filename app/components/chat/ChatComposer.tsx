"use client"

import { memo, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Character } from "../../types/character"
import type { User } from "../../types/user"
import type { Speaker } from "../../hooks/useChat"

interface ChatComposerProps {
  user: User
  characters: Character[]
  onSend: (content: string, speaker: Speaker) => void
  compact?: boolean
}

/**
 * Message input with a "speak as" picker: yourself or one of your characters. A DM can also
 * speak as any NPC or monster (the server enforces the same rules).
 */
function ChatComposer({ user, characters, onSend, compact = false }: ChatComposerProps) {
  const [text, setText] = useState("")
  const [speaker, setSpeaker] = useState<Speaker>({ name: user.username, type: "user" })

  useEffect(() => {
    setSpeaker({ name: user.username, type: "user" })
  }, [user.username])

  const speakable = useMemo(
    () =>
      characters.filter(
        (c) => c.userId === user.id || (user.role === "DM" && (c.category ?? c.Category) !== "Party")
      ),
    [characters, user.id, user.role]
  )

  const send = () => {
    if (!text.trim()) return
    onSend(text, speaker)
    setText("")
  }

  const picker = (
    <select
      value={`${speaker.type}:${speaker.name}`}
      onChange={(e) => {
        const raw = e.target.value
        const i = raw.indexOf(":")
        setSpeaker({ type: raw.slice(0, i) as Speaker["type"], name: raw.slice(i + 1) })
      }}
      className={
        compact
          ? "w-full p-1.5 text-xs border rounded-md bg-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          : "mr-2 p-2 h-full border rounded-md bg-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      }
      title="Speak as"
    >
      <option value={`user:${user.username}`}>{user.username} (You)</option>
      {speakable.map((c) => (
        <option key={c.CharacterId} value={`character:${c.Name}`}>
          {c.Name} (Character)
        </option>
      ))}
    </select>
  )

  const input = (
    <Input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && send()}
      placeholder={compact ? "Message…" : "Type a message..."}
      maxLength={2000}
      className={compact ? "flex-1 h-8 text-xs bg-stone-200" : "flex-grow mr-2 bg-stone-200"}
    />
  )

  if (compact) {
    return (
      <div className="flex flex-col gap-1.5">
        {picker}
        <div className="flex gap-1">
          {input}
          <Button type="button" size="sm" className="h-8 px-2 text-xs shrink-0" onClick={send}>
            Send
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center h-10">
      {picker}
      {input}
      <Button onClick={send}>Send</Button>
    </div>
  )
}

export default memo(ChatComposer)
