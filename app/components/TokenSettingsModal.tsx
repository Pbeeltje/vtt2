import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { LayerImage } from "../types/layerImage"

interface TokenSettingsModalProps {
  token: LayerImage | null
  onClose: () => void
  onUpdateScale: (tokenId: string, scale: number) => void
  onUpdateAura: (tokenId: string, auraColor: string | null, auraRadius: number | null) => void
  gridSize: number
}

export default function TokenSettingsModal({ token, onClose, onUpdateScale, onUpdateAura, gridSize }: TokenSettingsModalProps) {
  const [scale, setScale] = useState(token ? (token.width || gridSize) / gridSize : 1)
  const [auraColor, setAuraColor] = useState(token?.auraColor || '#87CEEB')
  const [auraRadius, setAuraRadius] = useState(token?.auraRadius || 1)
  const [auraEnabled, setAuraEnabled] = useState(Boolean(token?.auraColor && token?.auraRadius && token.auraRadius > 0))

  if (!token) return null

  const handleSave = () => {
    onUpdateScale(token.id, scale)
    onUpdateAura(token.id, auraEnabled ? auraColor : null, auraEnabled ? auraRadius : null)
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  const currentSize = Math.round(scale * gridSize)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
        
        {/* Scale Section */}
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuraRadius(Math.max(0, parseInt(e.target.value) || 1))}
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