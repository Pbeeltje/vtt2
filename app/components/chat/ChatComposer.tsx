"use client"

import { memo, useEffect, useMemo, useState } from "react"
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
      className={`jade-input max-w-[45%] shrink-0 cursor-pointer px-1.5 font-semibold text-[var(--jade-name)] ${compact ? "h-7 text-xs" : "h-8 text-sm"}`}
      title="Speak as"
      aria-label="Speak as"
    >
      <option value={`user:${user.username}`}>{user.username} (you)</option>
      {speakable.map((c) => (
        <option key={c.CharacterId} value={`character:${c.Name}`}>
          {c.Name}
        </option>
      ))}
    </select>
  )

  return (
    <div className="flex items-center gap-1.5">
      {picker}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        placeholder={compact ? "Message…" : "Say something…"}
        maxLength={2000}
        aria-label="Message"
        className={`jade-input min-w-0 flex-1 px-2 ${compact ? "h-7 text-xs" : "h-8 text-sm"}`}
      />
      <button type="button" className={`jade-btn ${compact ? "!h-7 !px-2 text-xs" : "text-sm"}`} onClick={send}>
        Send
      </button>
    </div>
  )
}

export default memo(ChatComposer)
