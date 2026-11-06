"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { JadeDialog } from "@/components/ui/jade-dialog"
import type { StatusField } from "./TokenRenderer"

/** Which character stat is being edited, and its value when the dialog opened. */
export interface StatusModalState {
  type: StatusField
  characterId: number
  characterName: string
  current: number
  max: number
}

interface StatusModalProps {
  state: StatusModalState | null
  onClose: () => void
  onSave: (value: number) => void
}

const LABEL: Record<StatusField, string> = { guard: "Guard", strength: "Strength", mp: "MP" }

/** Sets a token's Guard, Strength or MP from the map. */
export default function StatusModal({ state, onClose, onSave }: StatusModalProps) {
  return (
    <JadeDialog
      open={state !== null}
      onOpenChange={(open) => !open && onClose()}
      title={state ? `${LABEL[state.type]}: ${state.characterName}` : ""}
      description={state ? `Set ${state.characterName}'s ${LABEL[state.type]}, out of ${state.max}.` : ""}
      className="max-w-xs"
    >
      {state && <StatusForm key={`${state.characterId}-${state.type}`} state={state} onClose={onClose} onSave={onSave} />}
    </JadeDialog>
  )
}

function StatusForm({ state, onClose, onSave }: { state: StatusModalState } & Omit<StatusModalProps, "state">) {
  const [draft, setDraft] = useState(String(state.current))
  const value = Math.max(0, parseInt(draft, 10) || 0)
  const step = (by: number) => setDraft(String(Math.max(0, value + by)))
  // Clicking − or + leaves the cursor in the number, so Enter still saves.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault()

  return (
    <form
      className="mt-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(value)
      }}
    >
      <div className="flex items-center justify-center gap-2">
        <button type="button" className="jade-btn w-8 px-0" onMouseDown={keepFocus} onClick={() => step(-1)} title="One less" aria-label="One less">
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="jade-input h-9 w-20 text-center text-lg"
          aria-label={LABEL[state.type]}
          autoFocus
        />
        <button type="button" className="jade-btn w-8 px-0" onMouseDown={keepFocus} onClick={() => step(1)} title="One more" aria-label="One more">
          <Plus className="h-4 w-4" />
        </button>
        <span className="jade-outline pl-1 text-lg text-[var(--jade-ink)]">/ {state.max}</span>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="jade-btn min-w-20" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="jade-btn min-w-20">
          Save
        </button>
      </div>
    </form>
  )
}
