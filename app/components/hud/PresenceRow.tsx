"use client"

import { memo } from "react"
import { DEFAULT_AVATAR_URL } from "@/lib/player-colors"
import type { PlayerProfile } from "../../hooks/usePresence"
import { thumbUrl } from "@/lib/upload-url"

interface PresenceRowProps {
  online: PlayerProfile[]
  currentUserId: number
  /** Clicking your own portrait opens your profile (avatar and colour). */
  onOpenProfile: () => void
}

/**
 * Everyone logged in to the table right now: avatar with their name underneath in their player
 * colour. Scrolls sideways when the table is full.
 */
function PresenceRow({ online, currentUserId, onOpenProfile }: PresenceRowProps) {
  return (
    <div className="flex h-full items-start gap-3 overflow-x-auto overflow-y-hidden px-[5px] pt-2" aria-label="Players online">
      {online.map((player) => {
        const own = player.id === currentUserId
        return (
          <button
            key={player.id}
            type="button"
            disabled={!own}
            onClick={onOpenProfile}
            className="flex w-[88px] shrink-0 flex-col items-center gap-1.5 disabled:cursor-default"
            title={own ? `${player.username} (you): change avatar or colour` : `${player.username}${player.role === "DM" ? " (DM)" : ""}`}
          >
            <span
              className="relative block h-[88px] w-[88px] bg-[#6b6f68] bg-cover bg-center"
              style={{
                backgroundImage: `url("${thumbUrl(player.avatarUrl || DEFAULT_AVATAR_URL, 88)}")`,
                // The scene plate's frame (.jade-well), without its dark fill.
                boxShadow: "0 0 0 2px var(--jade-edge), 0 0 0 4px var(--jade-line), 0 0 0 5px var(--jade-edge)",
              }}
            >
              {player.role === "DM" && (
                <b className="jade-sc absolute bottom-0 right-0 bg-[#0a0d0a]/80 px-1 text-[11px] font-bold leading-[15px] text-[var(--jade-gold-hi)]">
                  DM
                </b>
              )}
            </span>
            <em
              className="jade-sc jade-outline w-full truncate text-center text-[15px] font-semibold not-italic leading-tight"
              style={{ color: player.color }}
            >
              {player.username}
            </em>
          </button>
        )
      })}
    </div>
  )
}

export default memo(PresenceRow)
