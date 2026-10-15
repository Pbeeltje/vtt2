"use client"

import { memo } from "react"

interface ScenePlateProps {
  sceneName: string | null
  tokenCount: number
  isDM: boolean
  /** Whether players currently see this scene (it is the active scene). */
  isLive: boolean
  onMakeLive: () => void
}

/** The current scene's name, and for the DM whether players can see it. */
function ScenePlate({ sceneName, tokenCount, isDM, isLive, onMakeLive }: ScenePlateProps) {
  return (
    <div className="jade-well my-2 flex w-[246px] shrink-0 flex-col items-start justify-between px-3 py-2.5">
      <div className="min-w-0 max-w-full">
        <b className="block truncate text-base font-semibold leading-tight text-[var(--jade-ink-hi)]" title={sceneName ?? undefined}>
          {sceneName ?? "No scene loaded"}
        </b>
        <small className="mt-0.5 block text-xs text-[var(--jade-muted)]">
          {sceneName ? `${tokenCount} token${tokenCount === 1 ? "" : "s"} on the map` : isDM ? "Pick one under Scenes" : "Waiting for the DM"}
        </small>
      </div>
      {isDM && sceneName && (
        isLive ? (
          <span className="jade-sc rounded-sm bg-[var(--jade-good)] px-2 py-1 text-[11px] font-semibold leading-none text-[#0a1a0a]">LIVE FOR PLAYERS</span>
        ) : (
          <button type="button" className="jade-btn !h-7 text-sm" onClick={onMakeLive} title="Show this scene to the players">
            Make live for players
          </button>
        )
      )}
    </div>
  )
}

export default memo(ScenePlate)
