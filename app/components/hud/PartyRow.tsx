"use client"

import { memo } from "react"
import type { PartyMember } from "../../hooks/useParty"
import type { User } from "../../types/user"
import { thumbUrl } from "@/lib/upload-url"

interface PartyRowProps {
  party: PartyMember[]
  user: User
  /** The character whose sheet is open, framed green. */
  openCharacterId: number | null
  onOpenSheet: (characterId: number) => void
}

function ratio(current?: number | null, max?: number | null) {
  if (!max || max <= 0) return null
  return Math.max(0, Math.min(1, (current ?? 0) / max))
}

/**
 * The party's portraits with Guard and MP bars (scrolls sideways past about 10). A player sees the characters they play first
 * (in gold), then a divider and the rest of the party; the DM sees the party in order.
 */
function PartyRow({ party, user, openCharacterId, onOpenSheet }: PartyRowProps) {
  const isDM = user.role === "DM"
  const mine = isDM ? [] : party.filter((c) => c.userId === user.id)
  const ordered = isDM ? party : [...mine, ...party.filter((c) => c.userId !== user.id)]

  return (
    <div className="flex h-full items-start gap-[5px] overflow-x-auto overflow-y-hidden pt-1.5" aria-label="Party">
      {ordered.map((member, index) => {
        const own = !isDM && member.userId === user.id
        const canOpen = isDM || own
        const guard = ratio(member.Guard, member.MaxGuard)
        const mp = ratio(member.Mp, member.MaxMp)
        const guardTone = guard === null || guard >= 1 ? "good" : guard <= 0.25 ? "crit" : "low"
        const picture = member.PortraitUrl || member.TokenUrl
        const open = openCharacterId === member.CharacterId
        return (
          <div key={member.CharacterId} className="flex shrink-0 items-start">
            {!isDM && index === mine.length && mine.length > 0 && <PartyDivider />}
            <button
              type="button"
              disabled={!canOpen}
              onClick={() => onOpenSheet(member.CharacterId)}
              className="relative flex w-16 flex-col gap-[3px] text-left disabled:cursor-default"
              title={`${member.Name}${member.ownerUsername ? `, played by ${member.ownerUsername}` : ""}${canOpen ? " (open sheet)" : ""}`}
            >
              <span
                className="relative block h-[72px] w-16 bg-[#111] bg-cover bg-[center_25%]"
                style={{
                  backgroundImage: picture ? `url("${thumbUrl(picture, 72)}")` : undefined,
                  boxShadow: open
                    ? `0 0 0 2px #0a0d0a, 0 0 0 3px #48d85b${own ? ", 0 0 0 5px #e0c25a" : ""}, 0 0 10px rgba(72,216,91,.5)`
                    : own
                      ? "0 0 0 2px #0a0d0a, 0 0 0 3px #e0c25a"
                      : "0 0 0 2px #0a0d0a, 0 0 0 3px #7d896f",
                }}
              >
                {!picture && (
                  <span className="jade-title absolute inset-0 grid place-items-center text-2xl text-[var(--jade-muted)]">
                    {member.Name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                {member.MaxGuard ? (
                  <b
                    className="jade-outline absolute left-[3px] top-[2px] text-xs font-bold"
                    style={{ color: guardTone === "good" ? "#7cf08a" : guardTone === "crit" ? "#ff7a5a" : "#ffd24a" }}
                  >
                    {member.Guard ?? 0}/{member.MaxGuard}
                  </b>
                ) : null}
                {own && <i className="absolute right-[3px] top-[3px] h-2 w-2 rotate-45 bg-[#ffd96a] shadow-[0_0_0_1px_#000]" aria-hidden />}
              </span>
              <span className="flex flex-col gap-[2px]">
                <Bar value={guard ?? 1} tone={guardTone} />
                {mp !== null && <Bar value={mp} tone="mp" />}
              </span>
              <em
                className={`jade-sc truncate text-center text-[10px] font-semibold not-italic leading-none ${own ? "text-[#ffd96a]" : "text-[#c9c3a8]"}`}
              >
                {member.Name}
              </em>
            </button>
          </div>
        )
      })}
    </div>
  )
}

const BAR_FILL: Record<string, string> = {
  good: "linear-gradient(#7cf08a,#2a9b3a)",
  low: "linear-gradient(#ffe07a,#c98a1a)",
  crit: "linear-gradient(#ff8a6a,#b02a1a)",
  mp: "linear-gradient(#9fd6ff,#2a6fb0)",
}

function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <span className="relative block h-[5px] bg-[#0b0e0b] shadow-[0_0_0_1px_#000]">
      <span className="absolute inset-y-0 left-0" style={{ width: `${Math.round(value * 100)}%`, background: BAR_FILL[tone] }} />
    </span>
  )
}

function PartyDivider() {
  return (
    <span className="relative mr-[5px] block h-[100px] w-3.5" aria-hidden>
      <span className="absolute inset-y-0 left-1.5 w-[3px] bg-[linear-gradient(90deg,#0a0d0a_33%,#8e9a80_33%_66%,#0a0d0a_66%)]" />
      <span className="absolute left-[3px] top-11 h-2 w-2 rotate-45 bg-[var(--jade-gold-hi)] shadow-[0_0_0_2px_#0a0d0a]" />
    </span>
  )
}

export default memo(PartyRow)
