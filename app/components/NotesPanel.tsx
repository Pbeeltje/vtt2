"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { confirm } from "@/components/ui/confirm-dialog"
import { MarkdownContent } from "@/components/MarkdownContent"
import { toast } from "@/components/ui/use-toast"
import type { JournalNote } from "@/app/types/journal-note"
import { api, errorMessage } from "../lib/api"

/** "Oct 16, 2026 · 14:05" in local time. */
const formatNoteDate = (iso: string) => {
  const d = new Date(iso)
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
  return `${date} · ${time}`
}

const lastKey = (userId: number) => `vtt-journal-last-note-${userId}`

/** Most recently edited first. */
const newestFirst = (list: JournalNote[]) =>
  [...list].sort((a, b) => new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime())

const createNote = (title: string) => api<JournalNote>("/api/journal-notes", { method: "POST", body: { title, content: "" } })

const failed = (title: string, error: unknown) => toast({ title, description: errorMessage(error), variant: "destructive" })

type NotesPanelProps = {
  userId: number
  /** Opened from the round menu in the bottom panel. */
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * A player's private journal: several markdown notes, autosaved while typing. Each user always
 * has at least one note; the last one opened is remembered per user.
 */
export default function NotesPanel({ userId, open, onOpenChange: setOpen }: NotesPanelProps) {
  const [notes, setNotes] = useState<JournalNote[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftContent, setDraftContent] = useState("")
  const [loading, setLoading] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Typed since the last save. */
  const dirty = useRef(false)
  // What the (debounced) save sends: the note being edited and its text right now.
  const editing = useRef<{ id: number | null; title: string; content: string }>({ id: null, title: "", content: "" })
  const journalLoadedRef = useRef(false)
  /** The first load while it runs: opening again meanwhile waits for it instead of loading twice. */
  const journalLoading = useRef<Promise<void> | null>(null)

  /** Opens a note in the editor (null: none) and remembers it for next time. */
  const showNote = useCallback(
    (note: JournalNote | null) => {
      editing.current = { id: note?.Id ?? null, title: note?.Title ?? "", content: note?.Content ?? "" }
      dirty.current = false
      setSelectedId(note?.Id ?? null)
      setDraftTitle(note?.Title ?? "")
      setDraftContent(note?.Content ?? "")
      if (!note) return
      try {
        localStorage.setItem(lastKey(userId), String(note.Id))
      } catch {
        /* storage unavailable: just don't remember */
      }
    },
    [userId]
  )

  /** Saves the open note now, instead of waiting for the typing pause. */
  const flushSave = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = null
    const { id, title, content } = editing.current
    if (!dirty.current || id == null) return
    dirty.current = false
    try {
      const updated = await api<JournalNote>(`/api/journal-notes/${id}`, { method: "PATCH", body: { title, content } })
      setNotes((prev) => newestFirst(prev.map((n) => (n.Id === updated.Id ? updated : n))))
    } catch (error) {
      // Still unsaved: the next edit, switch or close tries again.
      if (editing.current.id === id) dirty.current = true
      failed("Couldn't save your note", error)
    }
  }, [])

  const scheduleSave = useCallback(() => {
    dirty.current = true
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void flushSave(), 650)
  }, [flushSave])

  const loadJournal = useCallback(async () => {
    setLoading(true)
    try {
      let list = newestFirst(await api<JournalNote[]>("/api/journal-notes"))
      if (list.length === 0) list = [await createNote("")]
      journalLoadedRef.current = true
      setNotes(list)
      let storedId = NaN
      try {
        storedId = parseInt(localStorage.getItem(lastKey(userId)) ?? "", 10)
      } catch {
        /* storage unavailable */
      }
      showNote(list.find((n) => n.Id === storedId) ?? list[0])
    } catch (error) {
      failed("Couldn't load your notes", error)
    } finally {
      setLoading(false)
    }
  }, [userId, showNote])

  const initPanel = useCallback(() => {
    if (journalLoadedRef.current) return Promise.resolve()
    journalLoading.current ??= loadJournal().finally(() => (journalLoading.current = null))
    return journalLoading.current
  }, [loadJournal])

  useEffect(() => {
    journalLoadedRef.current = false
    journalLoading.current = null
  }, [userId])

  useEffect(() => {
    if (open) void initPanel()
    else void flushSave()
  }, [open, initPanel, flushSave])

  const handleSelectNote = async (value: string) => {
    const nid = parseInt(value, 10)
    if (!Number.isFinite(nid) || nid === selectedId) return
    await flushSave()
    const note = notes.find((x) => x.Id === nid)
    if (note) showNote(note)
  }

  const handleAddNote = async () => {
    await flushSave()
    try {
      const note = await createNote("New note")
      setNotes((prev) => newestFirst([note, ...prev]))
      showNote(note)
    } catch (error) {
      failed("Couldn't add a note", error)
    }
  }

  const handleDeleteNote = async () => {
    if (selectedId == null) return
    if (!(await confirm({ title: "Delete this note?", description: "This cannot be undone.", confirmLabel: "Delete", destructive: true }))) return
    await flushSave()
    try {
      await api(`/api/journal-notes/${selectedId}`, { method: "DELETE" })
      const rest = notes.filter((n) => n.Id !== selectedId)
      // Never leave the journal empty.
      const next = rest[0] ?? (await createNote(""))
      setNotes(rest.length ? rest : [next])
      showNote(next)
    } catch (error) {
      failed("Couldn't delete the note", error)
    }
  }

  const onTitleChange = (v: string) => {
    setDraftTitle(v)
    editing.current.title = v
    scheduleSave()
  }

  const onContentChange = (v: string) => {
    setDraftContent(v)
    editing.current.content = v
    scheduleSave()
  }

  return (
    <>
      {open && (
        <>
          <div className="fixed left-0 top-0 z-[44] flex h-[calc(100vh-var(--hud-h))] min-h-0 w-[min(22rem,calc(100vw-2.75rem))] flex-col gap-2 p-2 jade jade-marble shadow-[0_0_0_2px_#0a0d0a,inset_0_0_0_2px_#8e9a80,0_12px_26px_rgba(0,0,0,.8)]">
          <div className="jade-well flex items-center gap-1 px-2 py-1.5">
            <Select
              value={selectedId != null ? String(selectedId) : undefined}
              onValueChange={handleSelectNote}
              disabled={loading || notes.length === 0}
            >
              <SelectTrigger className="h-9 min-w-0 flex-1 text-xs">
                <SelectValue placeholder={loading ? "Loading…" : "Pick a note"} />
              </SelectTrigger>
              <SelectContent className="jade">
                {notes.map((n) => (
                  <SelectItem key={n.Id} value={String(n.Id)} className="text-xs">
                    {formatNoteDate(n.UpdatedAt)} —{" "}
                    {n.Title.trim() || "Untitled"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              title="New note"
              onClick={() => void handleAddNote()}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              title="Delete note"
              disabled={selectedId == null}
              onClick={() => void handleDeleteNote()}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              title="Close"
              onClick={() => {
                void flushSave()
                setOpen(false)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="jade-well px-2 py-2">
            <Input
              value={draftTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Title"
              className="h-8 text-sm"
            />
          </div>

          <Tabs defaultValue="write" className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-1">
            <TabsList className="h-8 w-full shrink-0">
              <TabsTrigger value="write" className="text-xs">
                Write
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs">
                Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent value="write" className="mt-2 min-h-0 flex-1 data-[state=inactive]:hidden">
              <ScrollArea className="h-[calc(100vh-var(--hud-h)-10.5rem)] jade-inset">
                <textarea
                  value={draftContent}
                  onChange={(e) => onContentChange(e.target.value)}
                  placeholder="Markdown supported…"
                  disabled={loading}
                  className="min-h-[calc(100vh-var(--hud-h)-11.5rem)] w-full resize-none bg-transparent p-3 font-mono text-sm outline-hidden disabled:opacity-60"
                  spellCheck
                />
              </ScrollArea>
            </TabsContent>
            <TabsContent value="preview" className="mt-2 min-h-0 flex-1 data-[state=inactive]:hidden">
              <ScrollArea className="h-[calc(100vh-var(--hud-h)-10.5rem)] jade-inset p-3">
                {draftContent.trim() ? (
                  <MarkdownContent markdown={draftContent} />
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing to preview.</p>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
          </div>

        </>
      )}
    </>
  )
}
