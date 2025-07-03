import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { LayerImage } from "../types/layerImage"

interface TokenSettingsModalProps {
  token: LayerImage | null
  onClose: () => void
  onUpdateScale: (tokenId: string, scale: number) => void
  gridSize: number
}

export default function TokenSettingsModal({ token, onClose, onUpdateScale, gridSize }: TokenSettingsModalProps) {
  const [scale, setScale] = useState(token ? (token.width || gridSize) / gridSize : 1)

  if (!token) return null

  const handleSave = () => {
    onUpdateScale(token.id, scale)
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  const currentSize = Math.round(scale * gridSize)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
        <h2 className="text-xl font-semibold mb-4">Token Settings</h2>
        
        {token.character && (
          <div className="mb-4">
            <Label className="text-sm font-medium text-gray-700">Character</Label>
            <div className="text-lg font-semibold">{token.character.Name}</div>
          </div>
        )}

        <div className="mb-6">
          <Label className="text-sm font-medium text-gray-700 mb-2 block">
            Token Scale (relative to {gridSize}px grid size)
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={scale}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScale(parseFloat(e.target.value) || 1)}
              min={0.1}
              max={5}
              step={0.1}
              className="w-20 px-2 py-1 border rounded"
            />
            <span className="text-sm text-gray-600">x</span>
            <span className="text-sm text-gray-500">= {currentSize}px</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Range: 0.1x to 5x (10px to {gridSize * 5}px)
          </div>
        </div>

        <div className="flex gap-2 justify-end">
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