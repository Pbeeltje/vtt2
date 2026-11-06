import { memo } from "react"
import Image from "next/image"
import { tokenCharacterId } from "@/lib/scene-model"
import { thumbUrl } from "@/lib/upload-url"
import { Settings } from "lucide-react"
import type { LayerImage } from "../../types/layerImage"
import { STATUS_EFFECTS, StatusEffectIcon, isStatusEffect } from "../../lib/status-effects"
import type { TokenCharacter } from "../../lib/tokens"
import { MAP_ITEM_ATTR, MAP_Z } from "./map-layers"

export type StatusField = "guard" | "strength" | "mp"

export interface TokenHandlers {
  onItemClick: (e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => void
  onTokenDoubleClick: (item: LayerImage) => void
  onStatusClick: (type: StatusField, character: TokenCharacter, characterId: number) => void
  onOpenTokenSettings: (token: LayerImage) => void
}

interface TokenRendererProps extends TokenHandlers {
  tokens: LayerImage[]
  gridSize: number
  selected: ReadonlySet<string>
}

/** Pass stable handlers (see useStableCallback): each token then re-renders only when it changes. */
export default function TokenRenderer({ tokens, selected, ...rest }: TokenRendererProps) {
  return (
    <>
      {tokens.map((img) => (
        <TokenItem key={img.id} img={img} selected={selected.has(img.id)} {...rest} />
      ))}
    </>
  )
}

/** The values shown in circles above a selected character token. MP only for magic users. */
const STATUS_CIRCLES: Array<{
  field: StatusField
  label: string
  value: (c: TokenCharacter) => string
  /** Ring colour: green guard, red strength, blue MP. */
  ring: string
  shows?: (c: TokenCharacter) => boolean
}> = [
  { field: "guard", label: "Gd", value: (c) => `${c.Guard}/${c.MaxGuard}`, ring: "#5fbf6a" },
  { field: "strength", label: "Str", value: (c) => `${c.Strength}/${c.MaxStrength}`, ring: "#e0654a" },
  { field: "mp", label: "Mp", value: (c) => `${c.Mp}/${c.MaxMp}`, ring: "#5a9fe0", shows: (c) => c.Path === "Magic User" },
]

interface TokenItemProps extends TokenHandlers {
  img: LayerImage
  gridSize: number
  selected: boolean
}

/** One token: aura, image, status badge, and when selected its name, stats and settings. Moved by useItemDrag. */
const TokenItem = memo(function TokenItem({
  img,
  gridSize,
  selected,
  onItemClick,
  onTokenDoubleClick,
  onStatusClick,
  onOpenTokenSettings,
}: TokenItemProps) {
  const width = img.width || gridSize
  const height = img.height || gridSize
  const character = img.character
  const auraRadius = img.auraColor && img.auraRadius && img.auraRadius > 0 ? img.auraRadius * gridSize : 0

  return (
    <div
      {...{ [MAP_ITEM_ATTR]: img.id }}
      // An outline, not a border: selecting a token must not shift it.
      className={`absolute ${selected ? "outline outline-2 outline-[var(--jade-gold-hi)]" : ""}`}
      style={{ left: img.x, top: img.y, zIndex: MAP_Z.token }}
      onClick={(e) => onItemClick(e, img)}
      onDoubleClick={() => onTokenDoubleClick(img)}
    >
      {auraRadius > 0 && (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: width + auraRadius * 2,
            height: height + auraRadius * 2,
            left: -auraRadius,
            top: -auraRadius,
            zIndex: 35,
            background: `radial-gradient(circle, transparent ${width / 2}px, ${img.auraColor} ${width / 2}px)`,
            opacity: img.auraColor!.toLowerCase() === "#87ceeb" ? 0.6 : 0.3,
          }}
        />
      )}
      <div className="relative" style={{ width, height }}>
        <Image
          src={thumbUrl(img.url, Math.max(width, height))}
          alt={character?.Name ?? "Token"}
          width={width}
          height={height}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
          className="token-image"
          draggable={false}
        />

        {isStatusEffect(img.statusEffect) && (
          <div
            className="pointer-events-none absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#0a0d0a] bg-white shadow-md"
            style={{ zIndex: 39 }}
            title={STATUS_EFFECTS[img.statusEffect].label}
          >
            <StatusEffectIcon effect={img.statusEffect} className="h-4 w-4" />
          </div>
        )}

        {selected && (
          <div className="absolute -right-2 -top-2 z-40">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenTokenSettings(img)
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[#151b14] text-[var(--jade-gold-hi)] shadow-[0_0_0_1px_#0a0d0a,inset_0_0_0_1.5px_#e0c25a,0_2px_4px_rgba(0,0,0,.6)] hover:text-[#fff3b0]"
              title="Token settings"
              aria-label="Token settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {selected && character && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap" style={{ zIndex: 30 }}>
            <span className="jade-title text-sm">{character.Name}</span>
          </div>
        )}
      </div>

      {selected && character && (
        <div className="status-circles-container absolute -top-12 left-0 right-0 flex justify-center space-x-3" style={{ zIndex: 40 }}>
          {STATUS_CIRCLES.filter((s) => !s.shows || s.shows(character)).map((s) => (
            <div key={s.field} className="relative">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_40%,#2a3428,#0f140f_80%)] text-[11px] font-bold leading-none tracking-tighter text-[var(--jade-ink-hi)] tabular-nums shadow-[0_0_0_1px_#0a0d0a,inset_0_0_0_2px_var(--ring),0_2px_5px_rgba(0,0,0,.7)] hover:bg-[radial-gradient(circle_at_50%_40%,#3a4637,#151b14_80%)]"
                style={{ "--ring": s.ring } as React.CSSProperties}
                onClick={() => onStatusClick(s.field, character, tokenCharacterId(img)!)}
                title={`Set ${s.field === "mp" ? "MP" : s.field}`}
              >
                {s.value(character)}
              </button>
              <div className="jade-sc jade-outline pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-[var(--jade-ink)]">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
