"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { MarkdownContent } from "@/components/MarkdownContent"
import { useJobs } from "../../hooks/useJobs"
import type { Character } from "../../types/character"

interface JobsPanelProps {
  character: Character
  onClose: () => void
}

/**
 * The round menu's jobs screen: a character's current jobs with their full descriptions, to
 * read during play. Mounted only while open, so it loads fresh after edits on the sheet.
 */
export default function JobsPanel({ character, onClose }: JobsPanelProps) {
  const { jobs, loading } = useJobs(character.CharacterId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="jade jade-marble fixed left-0 top-0 z-[44] flex h-[calc(100vh-var(--hud-h))] min-h-0 w-[min(28rem,calc(100vw-2.75rem))] flex-col gap-2 p-2 shadow-[0_0_0_2px_#0a0d0a,inset_0_0_0_2px_#8e9a80,0_12px_26px_rgba(0,0,0,.8)]"
      role="dialog"
      aria-label={`${character.Name}'s jobs`}
    >
      <div className="jade-well flex items-center justify-between gap-2 px-3 py-2">
        <h2 className="jade-title truncate text-[20px] leading-none">{character.Name}&apos;s jobs</h2>
        <button type="button" onClick={onClose} className="text-[var(--jade-muted)] hover:text-white" title="Close" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="jade-well jade-fill min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <p className="text-sm text-[var(--jade-muted)]">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-[var(--jade-muted)]">No jobs yet. Add them on the Jobs tab of the character sheet.</p>
        ) : (
          <ul className="space-y-4">
            {jobs.map((job) => (
              <li key={job.JobId} className="border-b border-black/40 pb-4 last:border-0 last:pb-0">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <h3 className="jade-sc text-[15px] font-semibold text-[var(--jade-gold)]">{job.Name}</h3>
                  <span className="jade-sc shrink-0 text-xs text-[var(--jade-muted)]">Tier {job.Tier}</span>
                </div>
                {job.Description?.trim() ? (
                  <MarkdownContent markdown={job.Description} className="text-[#e6e0c8]" />
                ) : (
                  <p className="text-sm italic text-[var(--jade-muted)]">No description</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
