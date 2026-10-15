"use client"

import { memo } from "react"
import NotesTicker from "./hud/NotesTicker"
import ScenePlate from "./hud/ScenePlate"
import PresenceRow from "./hud/PresenceRow"
import PhaseColumn from "./hud/PhaseColumn"
import RoundMenu, { type RoundMenuItem } from "./hud/RoundMenu"
import type { PlayerProfile } from "../hooks/usePresence"
import type { PhaseName } from "../lib/phases"
import type { User } from "../types/user"

interface BottomBarProps {
  user: User
  online: PlayerProfile[]
  onOpenProfile: () => void
  sceneName: string | null
  tokenCount: number
  isSceneLive: boolean
  onMakeSceneLive: () => void
  phase: PhaseName | null
  onSetPhase: (phase: PhaseName | null) => void
  onNextPhase: () => void
  menuItems: RoundMenuItem[]
}

/**
 * The bottom HUD: the notes ticker in the knotwork band, then the marble panel with the scene,
 * the players online, the PQAR track and the round menu. Dice and chat live in the side panel.
 */
function BottomBar({
  user,
  online,
  onOpenProfile,
  sceneName,
  tokenCount,
  isSceneLive,
  onMakeSceneLive,
  phase,
  onSetPhase,
  onNextPhase,
  menuItems,
}: BottomBarProps) {
  const isDM = user.role === "DM"
  return (
    <div className="jade relative z-20 shrink-0">
      <NotesTicker isDM={isDM} loggedIn />
      <div className="jade-marble relative flex h-[var(--hud-panel)] gap-4 pl-3 pr-[178px]">
        <ScenePlate sceneName={sceneName} tokenCount={tokenCount} isDM={isDM} isLive={isSceneLive} onMakeLive={onMakeSceneLive} />
        <div className="min-w-0 flex-1">
          <PresenceRow online={online} currentUserId={user.id} onOpenProfile={onOpenProfile} />
        </div>
        <PhaseColumn phase={phase} onSetPhase={onSetPhase} />
        <div className="absolute -top-[22px] right-3">
          <RoundMenu items={menuItems} phase={phase} onNextPhase={onNextPhase} />
        </div>
      </div>
    </div>
  )
}

export default memo(BottomBar)
