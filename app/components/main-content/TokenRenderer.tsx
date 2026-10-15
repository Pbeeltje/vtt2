import { memo } from "react"
import Image from "next/image"
import { tokenCharacterId } from "@/lib/scene-model"
import { thumbUrl } from "@/lib/upload-url"
import { Settings } from "lucide-react"
import type { LayerImage } from "../../types/layerImage"
import { STATUS_EFFECTS, StatusEffectIcon, isStatusEffect } from "../../lib/status-effects"

interface TokenHandlers {
  onItemDragStart: (e: React.DragEvent<HTMLDivElement>, item: LayerImage, isToken: boolean) => void;
  onItemDrag: (e: React.DragEvent<HTMLDivElement>) => void;
  onItemDragEnd: () => void;
  onItemClick: (e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => void;
  onTokenDoubleClick: (item: LayerImage) => void;
  onStatusClick: (type: 'guard' | 'strength' | 'mp', character: any, characterId: number) => void;
  onOpenTokenSettings: (token: LayerImage) => void;
}

interface TokenRendererProps extends TokenHandlers {
  tokens: LayerImage[];
  gridSize: number;
  selectedIds: string[];
}

/** Pass stable handlers (see useStableCallback): each token then re-renders only when it changes. */
export default function TokenRenderer({ tokens, selectedIds, ...rest }: TokenRendererProps) {
  return (
    <>
      {tokens.map((img) => (
        <TokenItem key={img.id} img={img} selected={selectedIds.includes(img.id)} {...rest} />
      ))}
    </>
  )
}

interface TokenItemProps extends TokenHandlers {
  img: LayerImage;
  gridSize: number;
  selected: boolean;
}

const TokenItem = memo(function TokenItem({
  img,
  gridSize,
  selected,
  onItemDragStart,
  onItemDrag,
  onItemDragEnd,
  onItemClick,
  onTokenDoubleClick,
  onStatusClick,
  onOpenTokenSettings,
}: TokenItemProps) {
  return (
    <div
      data-token-id={img.id}
      className={`absolute ${selected ? "border-2 border-blue-500" : ""}`}
      style={{ left: img.x, top: img.y, zIndex: 40 }}
      draggable={true}
      onDragStart={(e) => onItemDragStart(e, img, true)}
      onDrag={onItemDrag}
      onDragEnd={onItemDragEnd}
      onClick={(e) => onItemClick(e, img)}
      onDoubleClick={() => onTokenDoubleClick(img)}
    >
      {/* Aura - rendered behind the token */}
      {img.auraColor && img.auraRadius && img.auraRadius > 0 && (
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            width: (img.width || gridSize) + (img.auraRadius * gridSize * 2),
            height: (img.height || gridSize) + (img.auraRadius * gridSize * 2),
            left: -(img.auraRadius * gridSize),
            top: -(img.auraRadius * gridSize),
            zIndex: 35,
            background: `radial-gradient(circle, transparent ${(img.width || gridSize) / 2}px, ${img.auraColor} ${(img.width || gridSize) / 2}px)`,
            opacity: img.auraColor.toLowerCase() === '#87ceeb' ? 0.6 : 0.3
          }}
        />
      )}
      <div className="relative" style={{ width: img.width || gridSize, height: img.height || gridSize }}>
        <Image
          src={thumbUrl(img.url, Math.max(img.width || gridSize, img.height || gridSize))}
          alt="Token"
          width={img.width || gridSize}
          height={img.height || gridSize}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          className="token-image"
        />

        {/* Status effect badge - bottom-right corner, always visible */}
        {isStatusEffect(img.statusEffect) && (
          <div
            className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-white shadow-md border border-gray-300 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 39 }}
            title={STATUS_EFFECTS[img.statusEffect].label}
          >
            <StatusEffectIcon effect={img.statusEffect} className="w-4 h-4" />
          </div>
        )}

        {/* Settings Gear - Show when selected */}
        {selected && (
          <div className="absolute -right-2 -top-2 z-40">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenTokenSettings(img);
              }}
              className="w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg"
              title="Token Settings"
            >
              <Settings className="w-3 h-3" />
            </button>
          </div>
        )}

        {selected && img.character && (
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap" style={{ zIndex: 30 }}>
            <span
              className="text-sm font-semibold text-black"
              style={{
                textShadow: `-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white`
              }}
            >
              {img.character.Name}
            </span>
          </div>
        )}
      </div>

      {/* Status Circles */}
      {selected && img.character && (
        <div className="status-circles-container absolute -top-12 left-0 right-0 flex justify-center space-x-3" style={{ zIndex: 40 }}>
          {/* Guard Circle */}
          <div className="status-circle guard-circle relative bg-white rounded-full p-1">
            <div
              className="w-9 h-9 rounded-full border-2 border-green-500 flex items-center justify-center text-[10px] font-bold leading-none tracking-tighter tabular-nums cursor-pointer hover:bg-green-50"
              onClick={() => onStatusClick('guard', img.character, tokenCharacterId(img)!)}
            >
              {img.character.Guard}/{img.character.MaxGuard}
            </div>
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">
              Gd
            </div>
          </div>

          {/* Strength Circle */}
          <div className="status-circle strength-circle relative bg-white rounded-full p-1">
            <div
              className="w-9 h-9 rounded-full border-2 border-red-500 flex items-center justify-center text-[10px] font-bold leading-none tracking-tighter tabular-nums cursor-pointer hover:bg-red-50"
              onClick={() => onStatusClick('strength', img.character, tokenCharacterId(img)!)}
            >
              {img.character.Strength}/{img.character.MaxStrength}
            </div>
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">
              Str
            </div>
          </div>

          {/* MP Circle (only for Magic Users) */}
          {img.character.Path === "Magic User" && (
            <div className="status-circle mp-circle relative bg-white rounded-full p-1">
              <div
                className="w-9 h-9 rounded-full border-2 border-blue-500 flex items-center justify-center text-[10px] font-bold leading-none tracking-tighter tabular-nums cursor-pointer hover:bg-blue-50"
                onClick={() => onStatusClick('mp', img.character, tokenCharacterId(img)!)}
              >
                {img.character.Mp}/{img.character.MaxMp}
              </div>
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">
                Mp
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
