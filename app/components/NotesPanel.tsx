"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { NotebookPen, Plus, Trash2, X } from "lucide-react"
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
import { MarkdownContent } from "@/components/MarkdownContent"
import { cn } from "@/lib/utils"
import type { JournalNote } from "@/app/types/journal-note"

const lastKey = (userId: number) => `vtt-journal-last-note-${userId}`

/** Matches `DrawingToolbar` container so notes feels like the same tool strip */
const DRAWING_MENU_SURFACE =
  "border border-stone-400/50 bg-stone-300/90 backdrop-blur-sm shadow-md"

type NotesPanelProps = {
  userId: number
}

export default function NotesPanel({ userId }: NotesPanelProps) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<JournalNote[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftContent, setDraftContent] = useState("")
  const [loading, setLoading] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftTitleRef = useRef("")
  const draftContentRef = useRef("")
  const selectedIdRef = useRef<number | null>(null)
  const journalLoadedRef = useRef(false)

  useEffect(() => {
    draftTitleRef.current = draftTitle
    draftContentRef.current = draftContent
  }, [draftTitle, draftContent])

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  const flushSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const id = selectedIdRef.current
    if (id == null) return
    const t = draftTitleRef.current
    const c = draftContentRef.current
    try {
      const res = await fetch(`/api/journal-notes/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, content: c }),
      })
      if (res.ok) {
        const updated = (await res.json()) as JournalNote
        setNotes((prev) => {
          const next = prev.map((n) => (n.Id === updated.Id ? updated : n))
          return [...next].sort(
            (a, b) => new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime()
          )
        })
      }
    } catch (e) {
      console.error("journal save:", e)
    }
  }, [])

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void flushSave(), 650)
  }, [flushSave])

  const initPanel = useCallback(async () => {
    if (journalLoadedRef.current) return
    setLoading(true)
    try {
      let res = await fetch("/api/journal-notes", { credentials: "include" })
      if (!res.ok) return
      let list = (await res.json()) as JournalNote[]

      if (list.length === 0) {
        const create = await fetch("/api/journal-notes", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "", content: "" }),
        })
        if (create.ok) {
          const row = (await create.json()) as JournalNote
          list = [row]
        }
      }

      if (list.length === 0) return

      journalLoadedRef.current = true
      setNotes(list)
      const stored = (() => {
        try {
          return localStorage.getItem(lastKey(userId))
        } catch {
          return null
        }
      })()
      const storedId = stored ? parseInt(stored, 10) : NaN
      const pick =
        list.find((n) => n.Id === storedId) ??
        list[0] ??
        null
      if (pick) {
        setSelectedId(pick.Id)
        setDraftTitle(pick.Title)
        setDraftContent(pick.Content)
        draftTitleRef.current = pick.Title
        draftContentRef.current = pick.Content
        try {
          localStorage.setItem(lastKey(userId), String(pick.Id))
        } catch {
          /* ignore */
        }
      }
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    journalLoadedRef.current = false
  }, [userId])

  useEffect(() => {
    if (open) void initPanel()
  }, [open, initPanel])

  useEffect(() => {
    if (!open) void flushSave()
  }, [open, flushSave])

  const handleOpenToggle = () => {
    if (open) {
      void flushSave()
      setOpen(false)
    } else {
      setOpen(true)
    }
  }

  const handleSelectNote = async (value: string) => {
    const nid = parseInt(value, 10)
    if (!Number.isFinite(nid) || nid === selectedId) return
    await flushSave()
    const n = notes.find((x) => x.Id === nid)
    if (!n) return
    setSelectedId(nid)
    setDraftTitle(n.Title)
    setDraftContent(n.Content)
    draftTitleRef.current = n.Title
    draftContentRef.current = n.Content
    try {
      localStorage.setItem(lastKey(userId), String(nid))
    } catch {
      /* ignore */
    }
  }

  const handleAddNote = async () => {
    await flushSave()
    try {
      const res = await fetch("/api/journal-notes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New note", content: "" }),
      })
      if (!res.ok) return
      const row = (await res.json()) as JournalNote
      setNotes((prev) =>
        [row, ...prev].sort(
          (a, b) => new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime()
        )
      )
      setSelectedId(row.Id)
      setDraftTitle(row.Title)
      setDraftContent(row.Content)
      draftTitleRef.current = row.Title
      draftContentRef.current = row.Content
      try {
        localStorage.setItem(lastKey(userId), String(row.Id))
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.error("create note:", e)
    }
  }

  const handleDeleteNote = async () => {
    if (selectedId == null) return
    if (!window.confirm("Delete this note?")) return
    await flushSave()
    try {
      const res = await fetch(`/api/journal-notes/${selectedId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) return
      const rest = notes.filter((n) => n.Id !== selectedId)
      setNotes(rest)
      if (rest.length === 0) {
        const create = await fetch("/api/journal-notes", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "", content: "" }),
        })
        if (create.ok) {
          const row = (await create.json()) as JournalNote
          setNotes([row])
          setSelectedId(row.Id)
          setDraftTitle(row.Title)
          setDraftContent(row.Content)
          draftTitleRef.current = row.Title
          draftContentRef.current = row.Content
          try {
            localStorage.setItem(lastKey(userId), String(row.Id))
          } catch {
            /* ignore */
          }
        } else {
          setSelectedId(null)
          setDraftTitle("")
          setDraftContent("")
        }
      } else {
        const next = rest[0]
        setSelectedId(next.Id)
        setDraftTitle(next.Title)
        setDraftContent(next.Content)
        draftTitleRef.current = next.Title
        draftContentRef.current = next.Content
        try {
          localStorage.setItem(lastKey(userId), String(next.Id))
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.error("delete note:", e)
    }
  }

  const onTitleChange = (v: string) => {
    setDraftTitle(v)
    draftTitleRef.current = v
    scheduleSave()
  }

  const onContentChange = (v: string) => {
    setDraftContent(v)
    draftContentRef.current = v
    scheduleSave()
  }

  const sortedForSelect = [...notes].sort(
    (a, b) => new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime()
  )

  return (
    <>
      {!open && (
        <button
          type="button"
          title="Notes"
          aria-expanded={false}
          aria-label="Open notes"
          onClick={handleOpenToggle}
          className={cn(
            "fixed left-2 top-1/2 z-[45] -translate-y-1/2 rounded-lg p-2 transition hover:bg-stone-300",
            DRAWING_MENU_SURFACE
          )}
        >
          <NotebookPen className="h-6 w-6 text-stone-800" strokeWidth={1.75} />
        </button>
      )}

      {open && (
        <>
          <div className="fixed left-0 top-0 z-[44] flex h-[calc(100vh-3.25rem)] min-h-0 w-[min(22rem,calc(100vw-2.75rem))] flex-col border-y border-r border-amber-200/80 bg-amber-50/92 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-1 border-b border-amber-200/70 bg-amber-100/50 px-2 py-1.5">
            <Select
              value={selectedId != null ? String(selectedId) : undefined}
              onValueChange={handleSelectNote}
              disabled={loading || sortedForSelect.length === 0}
            >
              <SelectTrigger className="h-9 min-w-0 flex-1 border-amber-200/80 bg-white/80 text-xs">
                <SelectValue placeholder={loading ? "Loading…" : "Pick a note"} />
              </SelectTrigger>
              <SelectContent>
                {sortedForSelect.map((n) => (
                  <SelectItem key={n.Id} value={String(n.Id)} className="text-xs">
                    {format(new Date(n.UpdatedAt), "MMM d, yyyy · HH:mm")} —{" "}
                    {n.Title.trim() || "Untitled"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-amber-200/80 bg-white/80"
              title="New note"
              onClick={() => void handleAddNote()}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-amber-200/80 bg-white/80"
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

          <div className="border-b border-amber-200/60 px-2 py-2">
            <Input
              value={draftTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Title"
              className="h-8 border-amber-200/80 bg-white/85 text-sm"
            />
          </div>

          <Tabs defaultValue="write" className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-1">
            <TabsList className="h-8 w-full shrink-0 bg-amber-200/40">
              <TabsTrigger value="write" className="text-xs">
                Write
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs">
                Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent value="write" className="mt-2 min-h-0 flex-1 data-[state=inactive]:hidden">
              <ScrollArea className="h-[calc(100vh-14rem)] rounded-md border border-amber-200/70 bg-white/70">
                <textarea
                  value={draftContent}
                  onChange={(e) => onContentChange(e.target.value)}
                  placeholder="Markdown supported…"
                  disabled={loading}
                  className="min-h-[calc(100vh-15rem)] w-full resize-none bg-transparent p-3 font-mono text-sm outline-none disabled:opacity-60"
                  spellCheck
                />
              </ScrollArea>
            </TabsContent>
            <TabsContent value="preview" className="mt-2 min-h-0 flex-1 data-[state=inactive]:hidden">
              <ScrollArea className="h-[calc(100vh-14rem)] rounded-md border border-amber-200/70 bg-white/80 p-3">
                {draftContent.trim() ? (
                  <MarkdownContent markdown={draftContent} />
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing to preview.</p>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
          </div>

          <button
            type="button"
            title="Close notes"
            aria-expanded={true}
            aria-label="Close notes"
            onClick={handleOpenToggle}
            className={cn(
              "fixed left-[min(22rem,calc(100vw-2.75rem))] top-1/2 z-[45] -translate-y-1/2 p-2 transition hover:bg-stone-300",
              DRAWING_MENU_SURFACE,
              "rounded-lg rounded-l-none border-l-0 border-r-0"
            )}
          >
            <NotebookPen className="h-6 w-6 text-stone-800" strokeWidth={1.75} />
          </button>
        </>
      )}
    </>
  )
}
