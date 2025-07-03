import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { LayerImage } from "../types/layerImage"

interface TokenSettingsModalProps {
  token: LayerImage | null
  onClose: () => void
  onUpdateScale: (tokenId: string, scale: number) => void
  onUpdateColor: (tokenId: string, color: string | null) => void
  gridSize: number
}

export default function TokenSettingsModal({ token, onClose, onUpdateScale, onUpdateColor, gridSize }: TokenSettingsModalProps) {
  const [scale, setScale] = useState(token ? (token.width || gridSize) / gridSize : 1)
  const [color, setColor] = useState(token?.color || '#ffffff')

  if (!token) return null

  const handleSave = () => {
    onUpdateScale(token.id, scale)
    onUpdateColor(token.id, color === '#ffffff' ? null : color)
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

        <div className="mb-6">
          <Label className="text-sm font-medium text-gray-700 mb-2 block">
            Token Color Overlay
          </Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(e.target.value)}
              className="w-12 h-10 border rounded cursor-pointer"
              title="Choose token color"
            />
            <div className="flex-1">
              <div className="text-sm text-gray-600 mb-1">Preview:</div>
              <div 
                className="w-8 h-8 rounded border-2 border-gray-300"
                style={{ 
                  backgroundColor: color,
                  opacity: 0.3,
                  backgroundImage: `url(${token.url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColor('#ffffff')}
              className="text-xs"
            >
              Clear
            </Button>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Color will be applied with 30% transparency over the token
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