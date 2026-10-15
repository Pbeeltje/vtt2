"use client"

import { memo } from "react"
import type { LucideIcon } from "lucide-react"
import { phaseInfo, type PhaseName } from "../../lib/phases"

export interface RoundMenuItem {
  key: string
  label: string
  /** An icon, or `text` (such as "STR") with an optional `value` under it. */
  icon?: LucideIcon
  text?: string
  value?: string | number
  onClick: () => void
  active?: boolean
  disabled?: boolean
}

interface RoundMenuProps {
  items: RoundMenuItem[]
  phase: PhaseName | null
  onNextPhase: () => void
}

const SIZE = 150
/** Radius of the dark ring around the PQAR button; the rim items sit in the band outside it. */
const INNER = 40
/** Labels sit halfway across the band between the inner ring and the outer rim. */
const RADIUS = (INNER + SIZE / 2) / 2

/** The Icewind Dale style wheel: character actions around the rim, the PQAR phase button in the middle. */
function RoundMenu({ items, phase, onNextPhase }: RoundMenuProps) {
  const info = phaseInfo(phase)
  const n = Math.max(items.length, 1)
  return (
    <div
      className="jade-marble-dark relative shrink-0 rounded-full"
      style={{
        width: SIZE,
        height: SIZE,
        boxShadow: "0 0 0 3px #0a0d0a, 0 0 0 6px #8e9a80, 0 0 0 8px #0a0d0a, 0 8px 20px rgba(0,0,0,.7), inset 0 0 18px #000",
        backgroundImage: "var(--tx-marble-dark)",
      }}
    >
      {/* Spokes run exactly halfway between neighbouring items, from the inner ring to the rim. */}
      <svg className="pointer-events-none absolute inset-0" width={SIZE} height={SIZE} aria-hidden>
        {items.length > 1 &&
          items.map((_, i) => {
            const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2
            const [cos, sin] = [Math.cos(a), Math.sin(a)]
            const c = SIZE / 2
            return (
              <g key={i}>
                <line x1={c + cos * INNER} y1={c + sin * INNER} x2={c + cos * c} y2={c + sin * c} stroke="#0a0d0a" strokeWidth={2.5} />
                <line x1={c + cos * INNER} y1={c + sin * INNER} x2={c + cos * c} y2={c + sin * c} stroke="rgba(142,154,128,.35)" strokeWidth={0.75} />
              </g>
            )
          })}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={INNER} fill="none" stroke="#0a0d0a" strokeWidth={3} />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={INNER} fill="none" stroke="rgba(142,154,128,.35)" strokeWidth={0.75} />
      </svg>
      {items.map((item, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2
        const Icon = item.icon
        return (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            disabled={item.disabled}
            title={item.label}
            aria-label={item.label}
            className={`absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${item.active ? "text-[#fff3b0] [filter:drop-shadow(0_0_6px_rgba(224,194,90,.8))]" : "text-[var(--jade-gold)] enabled:hover:text-[#fff3b0]"}`}
            style={{ left: SIZE / 2 + Math.cos(angle) * RADIUS, top: SIZE / 2 + Math.sin(angle) * RADIUS }}
          >
            {Icon ? (
              <Icon className="h-[22px] w-[22px] [filter:drop-shadow(1px_1px_0_rgba(0,0,0,.95))]" strokeWidth={1.9} />
            ) : (
              <span className="text-center leading-none [text-shadow:0_0_2px_#000,1px_1px_0_rgba(0,0,0,.95)]">
                <b className="jade-sc block text-[11px] font-bold">{item.text}</b>
                {item.value !== undefined && <small className="mt-px block text-[10px] font-semibold tabular-nums">{item.value}</small>}
              </span>
            )}
          </button>
        )
      })}
      <button
        type="button"
        onClick={onNextPhase}
        className="absolute left-1/2 top-1/2 grid h-[54px] w-[54px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-center"
        style={{
          background: "radial-gradient(circle at 40% 32%, #f6f0c8 0 5%, #c8a632 22%, #5a4510 70%)",
          boxShadow: "0 0 0 2px #0a0d0a, 0 0 0 4px #8e9a80, 0 0 0 5px #0a0d0a, inset 0 -5px 8px rgba(0,0,0,.45)",
        }}
        title={info ? `${info.name} phase. Click for the next phase` : "Start an encounter (Prepare phase)"}
        aria-label={info ? `Next phase (now ${info.name})` : "Start an encounter"}
      >
        <span>
          <b className="block font-[family-name:var(--font-spectral)] text-[22px] font-bold leading-none text-[#1d1606] [text-shadow:0_1px_0_rgba(255,255,255,.4)]">
            {info ? info.letter : "⚔"}
          </b>
          <small className="jade-sc mt-px block text-[8px] font-semibold leading-none text-[#2d2209]">PQAR</small>
        </span>
      </button>
    </div>
  )
}

export default memo(RoundMenu)
