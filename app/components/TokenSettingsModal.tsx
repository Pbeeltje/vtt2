import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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

/** Aura and status effect of one token, plus its size when it has no character sheet to take it from. Render it with key={token.id} so it starts from that token's values. */
export default function TokenSettingsModal({ token, onClose, onSave, gridSize }: TokenSettingsModalProps) {
  const [scale, setScale] = useState((token.width || gridSize) / gridSize)
  const [auraColor, setAuraColor] = useState(token.auraColor || '#87CEEB')
  const [auraRadius, setAuraRadius] = useState(token.auraRadius || 1)
  const [statusEffect, setStatusEffect] = useState<StatusEffect | null>(isStatusEffect(token.statusEffect) ? token.statusEffect : null)
  const [auraEnabled, setAuraEnabled] = useState(Boolean(token.auraColor && token.auraRadius && token.auraRadius > 0))

  const handleSave = () => {
    onSave(token.id, {
      scale: token.character ? undefined : Math.min(5, Math.max(0.1, scale)),
      auraColor: auraEnabled ? auraColor : null,
      auraRadius: auraEnabled ? auraRadius : null,
      statusEffect,
    })
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  const currentSize = Math.round(scale * gridSize)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="Token settings" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="bg-white rounded-lg p-6 w-[500px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Token Settings</h2>
          {token.character && (
            <div className="text-right">
              <div className="text-sm text-gray-500">Character</div>
              <div className="font-semibold">{token.character.Name}</div>
            </div>
          )}
        </div>
        
        {/* Scale Section: character tokens take their size from the sheet */}
        {!token.character && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <Label className="text-sm font-medium text-gray-700 mb-3 block">
            Token Scale
          </Label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={scale}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScale(parseFloat(e.target.value) || 1)}
              min={0.1}
              max={5}
              step={0.1}
              className="w-20 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-600">×</span>
            <span className="text-sm text-gray-500">= {currentSize}px</span>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Range: 0.1× to 5× (10px to {gridSize * 5}px)
          </div>
        </div>
        )}

        {/* Status Effect Section: one at a time, click the active one again to clear it */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <Label className="text-sm font-medium text-gray-700 mb-3 block">
            Status Effect
          </Label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status effect">
            {(Object.keys(STATUS_EFFECTS) as StatusEffect[]).map((effect) => (
              <button
                key={effect}
                type="button"
                role="radio"
                aria-checked={statusEffect === effect}
                title={STATUS_EFFECTS[effect].label}
                onClick={() => setStatusEffect(statusEffect === effect ? null : effect)}
                className={`w-10 h-10 rounded-md border-2 flex items-center justify-center bg-white hover:border-gray-400 ${
                  statusEffect === effect ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
                }`}
              >
                <StatusEffectIcon effect={effect} className="w-6 h-6" />
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={statusEffect === null}
              onClick={() => setStatusEffect(null)}
              className={`h-10 px-3 rounded-md border-2 text-sm bg-white hover:border-gray-400 ${
                statusEffect === null ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
              }`}
            >
              None
            </button>
          </div>
        </div>

        {/* Aura Section */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="aura-enabled"
              checked={auraEnabled}
              onChange={(e) => setAuraEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="aura-enabled" className="text-sm font-medium text-gray-700">
              Enable Token Aura
            </Label>
          </div>
          
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={auraColor}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuraColor(e.target.value)}
              className="w-12 h-12 border-2 border-gray-300 rounded-md cursor-pointer hover:border-gray-400"
              title="Choose aura color"
              disabled={!auraEnabled}
            />
            <div className="flex items-center gap-2">
              <Label className="text-sm text-gray-600">Radius:</Label>
              <input
                type="number"
                value={auraRadius}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuraRadius(Math.max(0, parseFloat(e.target.value) || 1))}
                min="0"
                max="5"
                step="0.5"
                className="w-16 px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!auraEnabled}
              />
              <span className="text-sm text-gray-500">grid units</span>
            </div>
                          <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAuraColor('#87CEEB')
                  setAuraRadius(1)
                }}
                className="text-xs"
                disabled={!auraEnabled}
              >
                Clear
              </Button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Aura will appear as a transparent circle around the token (30% opacity)
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
} 