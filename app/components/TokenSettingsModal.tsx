"use client"

import React, { useState } from "react"
import { JadeDialog } from "@/components/ui/jade-dialog"
import type { LayerImage } from "../types/layerImage"
import { STATUS_EFFECTS, StatusEffectIcon, isStatusEffect, type StatusEffect } from "../lib/status-effects"

/** `scale` is left out for character tokens: their size comes from the character sheet. */
export type TokenSettings = {
  scale?: number
  auraColor: string | null
  auraRadius: number | null
  statusEffect: StatusEffect | null
}

interface TokenSettingsModalProps {
  token: LayerImage
  onClose: () => void
  /** Saves size and aura together, so one change can't overwrite the other. */
  onSave: (tokenId: string, settings: TokenSettings) => void
  gridSize: number
}

const DEFAULT_AURA_COLOR = "#87CEEB"
const MIN_SCALE = 0.1
const MAX_SCALE = 5

/** Aura and status effect of one token, plus its size when it has no character sheet to take it from. Render it with key={token.id} so it starts from that token's values. */
export default function TokenSettingsModal({ token, onClose, onSave, gridSize }: TokenSettingsModalProps) {
  const [scale, setScale] = useState((token.width || gridSize) / gridSize)
  const [auraColor, setAuraColor] = useState(token.auraColor || DEFAULT_AURA_COLOR)
  const [auraRadius, setAuraRadius] = useState(token.auraRadius || 1)
  const [statusEffect, setStatusEffect] = useState<StatusEffect | null>(isStatusEffect(token.statusEffect) ? token.statusEffect : null)
  const [auraEnabled, setAuraEnabled] = useState(Boolean(token.auraColor && token.auraRadius && token.auraRadius > 0))

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(token.id, {
      scale: token.character ? undefined : Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)),
      auraColor: auraEnabled ? auraColor : null,
      auraRadius: auraEnabled ? auraRadius : null,
      statusEffect,
    })
    onClose()
  }

  return (
    <JadeDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Token settings"
      description={token.character ? `Status effect and aura of ${token.character.Name}'s token.` : "Size, status effect and aura of this token."}
      aside={
        token.character && (
          <div className="shrink-0 text-right">
            <div className="jade-sc text-xs text-[var(--jade-muted)]">Character</div>
            <div className="jade-title text-sm">{token.character.Name}</div>
          </div>
        )
      }
      className="max-w-md"
    >
      <form onSubmit={save} className="mt-5 space-y-4">
        {/* Character tokens take their size from the sheet. */}
        {!token.character && (
          <Section title="Size">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value) || 1)}
                min={MIN_SCALE}
                max={MAX_SCALE}
                step={0.1}
                className="jade-input h-8 w-20 px-2"
                aria-label="Scale"
              />
              <span className="text-[var(--jade-ink)]">× grid = {Math.round(scale * gridSize)}px</span>
            </div>
            <Hint>
              From {MIN_SCALE}× to {MAX_SCALE}× ({Math.round(MIN_SCALE * gridSize)}px to {MAX_SCALE * gridSize}px)
            </Hint>
          </Section>
        )}

        {/* One at a time; picking the active one again clears it. */}
        <Section title="Status effect">
          <div className="flex flex-wrap gap-2.5 p-0.5" role="radiogroup" aria-label="Status effect">
            {(Object.keys(STATUS_EFFECTS) as StatusEffect[]).map((effect) => (
              <button
                key={effect}
                type="button"
                role="radio"
                aria-checked={statusEffect === effect}
                data-lit={statusEffect === effect}
                title={STATUS_EFFECTS[effect].label}
                aria-label={STATUS_EFFECTS[effect].label}
                onClick={() => setStatusEffect(statusEffect === effect ? null : effect)}
                className="jade-slot h-10 w-10"
              >
                {/* As it shows on the token: a white badge. */}
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
                  <StatusEffectIcon effect={effect} className="h-5 w-5" />
                </span>
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={statusEffect === null}
              data-lit={statusEffect === null}
              onClick={() => setStatusEffect(null)}
              className="jade-slot jade-sc h-10 px-3 text-sm"
            >
              None
            </button>
          </div>
        </Section>

        <Section
          title={
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={auraEnabled} onChange={(e) => setAuraEnabled(e.target.checked)} className="h-4 w-4 accent-[#e0c25a]" />
              Aura
            </label>
          }
        >
          <fieldset disabled={!auraEnabled} className="flex flex-wrap items-center gap-3 disabled:opacity-45">
            <input
              type="color"
              value={auraColor}
              onChange={(e) => setAuraColor(e.target.value)}
              className="jade-input h-9 w-12 cursor-pointer p-1 disabled:cursor-default"
              title="Aura colour"
              aria-label="Aura colour"
            />
            <label className="flex items-center gap-2 text-[var(--jade-ink)]">
              Radius
              <input
                type="number"
                value={auraRadius}
                onChange={(e) => setAuraRadius(Math.max(0, parseFloat(e.target.value) || 1))}
                min={0}
                max={5}
                step={0.5}
                className="jade-input h-8 w-16 px-2"
              />
              cells
            </label>
            <button
              type="button"
              className="jade-btn h-8 text-sm"
              onClick={() => {
                setAuraColor(DEFAULT_AURA_COLOR)
                setAuraRadius(1)
              }}
            >
              Reset
            </button>
          </fieldset>
          <Hint>A see-through circle around the token.</Hint>
        </Section>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="jade-btn min-w-20" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="jade-btn min-w-20">
            Save
          </button>
        </div>
      </form>
    </JadeDialog>
  )
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="jade-inset space-y-2 p-3">
      <h3 className="jade-sc text-xs font-semibold text-[var(--jade-gold-hi)]">{title}</h3>
      {children}
    </section>
  )
}

const Hint = ({ children }: { children: React.ReactNode }) => <p className="text-xs text-[var(--jade-muted)]">{children}</p>
