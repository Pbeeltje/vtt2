"use client"

import { useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { DEFAULT_AVATAR_URL, PLAYER_COLORS, PLAYER_COLOR_NAMES } from "@/lib/player-colors"
import { api, errorMessage } from "../lib/api"
import { useImageUpload } from "./character-popup/useImageUpload"
import type { User } from "../types/user"

interface PlayerProfileProps {
  user: User
  onProfileChange: (changes: Pick<User, "color" | "avatarUrl">) => void
}

/** Your own avatar and player colour. Every player can edit these for themselves. */
export default function PlayerProfile({ user, onProfileChange }: PlayerProfileProps) {
  const [saving, setSaving] = useState(false)

  const save = async (changes: { color?: string; avatarUrl?: string | null }) => {
    setSaving(true)
    try {
      onProfileChange(await api<Pick<User, "color" | "avatarUrl">>("/api/user", { method: "PATCH", body: changes }))
    } catch (error) {
      toast({ title: "Profile not saved", description: errorMessage(error), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const avatar = useImageUpload("Avatar", (url) => void save({ avatarUrl: url }))
  const color = user.color ?? PLAYER_COLORS[0]

  return (
    <section className="jade-inset mb-4 flex gap-3 border border-[#3f4a3d] p-3" aria-label="Your profile">
      {avatar.input}
      <button
        type="button"
        onClick={avatar.pick}
        disabled={avatar.uploading || saving}
        className="group relative h-20 w-20 shrink-0 bg-[#6b6f68] bg-cover bg-center"
        style={{
          backgroundImage: `url("${user.avatarUrl || DEFAULT_AVATAR_URL}")`,
          boxShadow: `0 0 0 2px #0a0d0a, 0 0 0 4px ${color}`,
        }}
        title="Upload an avatar"
      >
        <span className="absolute inset-0 grid place-items-center bg-black/60 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {avatar.uploading ? "Uploading…" : "Upload"}
        </span>
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="jade-sc jade-outline truncate text-base font-semibold" style={{ color }}>
            {user.username}
          </span>
          {user.avatarUrl && (
            <button
              type="button"
              className="shrink-0 text-xs text-[var(--jade-muted)] underline-offset-2 hover:underline"
              disabled={saving}
              onClick={() => void save({ avatarUrl: null })}
            >
              Remove avatar
            </button>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs text-[var(--jade-muted)]">Your colour: portrait, name and map pings (shift+click)</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Player colour">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === color}
                aria-label={PLAYER_COLOR_NAMES[c]}
                title={PLAYER_COLOR_NAMES[c]}
                disabled={saving}
                onClick={() => c !== color && void save({ color: c })}
                className="h-6 w-6 rounded-full"
                style={{
                  background: c,
                  boxShadow: c === color ? "0 0 0 2px #0a0d0a, 0 0 0 4px var(--jade-gold-hi)" : "0 0 0 1px #0a0d0a",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
