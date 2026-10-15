"use client"

import { memo, useEffect, useRef, useState } from "react"
import { Feather, Pause, Play } from "lucide-react"
import type { Note } from "../../types/note"
import { toPlainText } from "@/lib/chat-text"

const SAFE_COLOR = /^#[0-9a-f]{3,8}$/i
const DEFAULT_COLOR = "#dc2626"

/**
 * The DM's notes, scrolling along the knotwork band above the bottom panel: the last 10, newest
 * first, each in its own colour. The DM clicks the band (or the quill) to post one.
 */
function NotesTicker({ isDM, loggedIn }: { isDM: boolean; loggedIn: boolean }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [saving, setSaving] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [paused, setPaused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loggedIn) {
      setNotes([])
      return
    }
    void (async () => {
      try {
        const res = await fetch("/api/notes")
        if (res.ok) setNotes((await res.json()) as Note[])
      } catch (error) {
        console.error("Error fetching notes:", error)
      }
    })()
  }, [loggedIn])

  // Home forwards the socket's notes_updated as a window event.
  useEffect(() => {
    const onUpdate = ((event: CustomEvent<Note[]>) => setNotes(event.detail)) as EventListener
    window.addEventListener("notes_updated", onUpdate)
    return () => window.removeEventListener("notes_updated", onUpdate)
  }, [])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const close = () => {
    setEditing(false)
    setDraft("")
    setColor(DEFAULT_COLOR)
    setConfirmClear(false)
  }

  const save = async () => {
    if (!isDM || saving) return
    if (!draft.trim()) {
      close()
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim(), color }),
      })
      if (res.ok) {
        setNotes((await res.json()) as Note[])
        close()
      } else {
        console.error("Error saving note:", await res.json().catch(() => null))
      }
    } catch (error) {
      console.error("Error saving note:", error)
    } finally {
      setSaving(false)
    }
  }

  const clearAll = async () => {
    if (!isDM) return
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/notes", { method: "DELETE", headers: { "Content-Type": "application/json" } })
      if (res.ok) {
        setNotes([])
        close()
      }
    } catch (error) {
      console.error("Error clearing notes:", error)
    } finally {
      setSaving(false)
    }
  }

  const textLength = notes.map((n) => n.Content).join("").length
  const duration = Math.max(19, Math.min(38, 19 + textLength * 0.095))

  const renderRun = (copy: number) =>
    notes.map((note) => (
      <span key={`${copy}-${note.Id}`} className="flex items-center">
        <span style={{ color: SAFE_COLOR.test(note.color || "") ? note.color : DEFAULT_COLOR }}>{toPlainText(note.Content)}</span>
        <span className="mx-[18px] text-[10px] text-[#6f7b62]" aria-hidden>
          ◆
        </span>
      </span>
    ))

  const textStyle = "jade-outline whitespace-nowrap text-[13px] font-bold uppercase leading-5 tracking-[0.14em]"

  return (
    <div className="jade-knot relative h-[var(--hud-band)] shrink-0">
      <div
        className={`jade-inset absolute inset-y-[3px] left-3 right-[184px] flex items-center overflow-hidden shadow-[0_0_0_2px_#0a0d0a,0_0_0_3px_#7d896f] ${isDM && !editing ? "cursor-text" : ""}`}
        onClick={() => isDM && !editing && setEditing(true)}
        title={isDM ? (editing ? undefined : "Click to post a note") : "DM notes"}
      >
        {!editing && notes.length > 0 && (
          <button
            type="button"
            className="jade-btn z-[1] !h-5 !px-1.5"
            onClick={(e) => {
              e.stopPropagation()
              setPaused((p) => !p)
            }}
            title={paused ? "Resume the ticker" : "Pause the ticker"}
            aria-label={paused ? "Resume the ticker" : "Pause the ticker"}
            aria-pressed={paused}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
        )}
        {isDM && !editing && (
          <button type="button" className="jade-btn z-[1] !h-5 !px-1.5" onClick={() => setEditing(true)} title="Post a note">
            <Feather className="h-3.5 w-3.5" />
          </button>
        )}
        {editing ? (
          <div className="flex flex-1 items-center gap-2 px-2">
            <button
              type="button"
              className="h-3.5 w-3.5 shrink-0 rounded-full shadow-[0_0_0_1px_#000,0_0_0_2px_#8e9a80]"
              style={{ backgroundColor: color }}
              // Keep focus in the input so its blur doesn't post the note first.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setColor(`#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`)}
              title="Pick another colour"
              aria-label="Pick another colour"
            />
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void save()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save()
                else if (e.key === "Escape") close()
              }}
              placeholder="Add a note. Enter to post, Esc to cancel"
              maxLength={200}
              disabled={saving}
              className={`${textStyle} min-w-0 flex-1 bg-transparent outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-[#7d896f]`}
              style={{ color }}
              aria-label="New note"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void clearAll()}
              disabled={saving || notes.length === 0}
              className="shrink-0 text-xs font-semibold text-[var(--jade-hit)] hover:underline disabled:opacity-40"
            >
              {confirmClear ? "Clear every note?" : "Clear all"}
            </button>
          </div>
        ) : notes.length > 0 ? (
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className={`jade-ticker-run inline-flex ${textStyle}`} style={{ animation: `jade-ticker ${duration}s linear infinite ${paused ? "paused" : "running"}` }}>
              {/* Rendered twice for a seamless loop. */}
              {renderRun(0)}
              {renderRun(1)}
            </div>
          </div>
        ) : (
          <span className={`${textStyle} px-3 text-[#7d896f]`}>No messages</span>
        )}
      </div>
    </div>
  )
}

export default memo(NotesTicker)
