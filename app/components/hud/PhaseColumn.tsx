"use client"

import { memo } from "react"
import { X } from "lucide-react"
import { PHASES, type PhaseName } from "../../lib/phases"

interface PhaseColumnProps {
  phase: PhaseName | null
  onSetPhase: (phase: PhaseName | null) => void
}

/** The PQAR track: click a phase to jump to it; the cross ends the encounter. */
function PhaseColumn({ phase, onSetPhase }: PhaseColumnProps) {
  return (
    <div className="flex h-full w-[132px] shrink-0 flex-col gap-1 py-1.5">
      <div className="flex h-4 items-center justify-between px-0.5">
        <span className="jade-sc jade-outline text-[10px] font-semibold text-[#d9d3b8]">{phase ? "ENCOUNTER" : "NO ENCOUNTER"}</span>
        {phase && (
          <button type="button" onClick={() => onSetPhase(null)} className="text-[var(--jade-hit)] hover:text-white" title="End the encounter" aria-label="End the encounter">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {PHASES.map((p) => {
        const active = p.name === phase
        return (
          <button
            key={p.name}
            type="button"
            data-active={active}
            onClick={() => onSetPhase(p.name)}
            className="jade-tab flex-1 text-[13px]"
            style={active ? { color: p.color, textShadow: `0 0 8px ${p.color}66` } : undefined}
            title={active ? `${p.name} phase` : `Go to the ${p.name} phase`}
          >
            {p.name}
          </button>
        )
      })}
    </div>
  )
}

export default memo(PhaseColumn)
