"use client"

import { memo, useState } from "react"
import DieIcon, { CustomDieIcon } from "./DieIcon"

const DICE = [4, 6, 8, 10, 12, 20, 30, 100]

interface DiceTrayProps {
  /** Rolls a dice expression (e.g. "2d6", "2d8kh1") on the server; the result appears in chat. */
  onRoll: (expression: string) => void
  /** The mini chat's row of dice, without the custom roll. */
  compact?: boolean
}

/** One slot per die; the "?" die opens how many to roll and a field for any expression. */
function DiceTray({ onRoll, compact = false }: DiceTrayProps) {
  const [count, setCount] = useState("1")
  const [expression, setExpression] = useState("")
  const [customOpen, setCustomOpen] = useState(false)

  const rollDie = (sides: number) => {
    const n = Math.min(100, Math.max(1, parseInt(count, 10) || 1))
    onRoll(`${n}d${sides}`)
    setCount("1")
  }

  const rollExpression = () => {
    if (!expression.trim()) return
    onRoll(expression.trim())
    setExpression("")
  }

  const dieButton = (sides: number, size: string) => (
    <button
      key={sides}
      type="button"
      className={`jade-slot aspect-square w-full ${size}`}
      onClick={() => rollDie(sides)}
      title={`Roll ${parseInt(count, 10) || 1}d${sides}`}
      aria-label={`Roll d${sides}`}
    >
      <DieIcon sides={sides} className="h-[70%] w-[70%] [filter:drop-shadow(1px_1px_0_rgba(0,0,0,.95))]" />
    </button>
  )

  if (compact) {
    return <div className="grid grid-cols-8 gap-1.5">{DICE.map((sides) => dieButton(sides, "max-h-8"))}</div>
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-9 gap-1.5">
        {DICE.map((sides) => dieButton(sides, ""))}
        <button
          type="button"
          className="jade-slot aspect-square w-full"
          data-lit={customOpen}
          onClick={() => setCustomOpen((open) => !open)}
          title={customOpen ? "Hide the custom roll" : "Custom roll: how many dice, or any expression"}
          aria-label="Custom roll"
          aria-expanded={customOpen}
        >
          <CustomDieIcon className="h-[70%] w-[70%] [filter:drop-shadow(1px_1px_0_rgba(0,0,0,.95))]" />
        </button>
      </div>
      {customOpen && (
        <div className="flex items-center gap-1.5 text-sm text-[var(--jade-muted)]">
          <input
            type="text"
            inputMode="numeric"
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            onFocus={(e) => e.target.select()}
            className="jade-input h-8 w-9 text-center text-sm font-semibold"
            aria-label="Number of dice the buttons roll"
            title="How many dice the buttons roll"
          />
          ×
          <input
            autoFocus
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") rollExpression()
              else if (e.key === "Escape") setCustomOpen(false)
            }}
            placeholder="2d8kh1+1"
            maxLength={100}
            className="jade-input h-8 min-w-0 flex-1 px-2 text-sm font-semibold"
            aria-label="Dice expression"
            title="Roll any expression: 3d6, d20+2, 2d8kh1 (keep highest), 4d6kl3 (keep lowest). Enter to roll."
          />
          <button type="button" className="jade-btn" onClick={rollExpression}>
            Roll
          </button>
        </div>
      )}
    </div>
  )
}

export default memo(DiceTray)
