"use client"

import { memo, useState, useEffect, useRef, useCallback } from "react"
import { GripVertical } from "lucide-react"
import ChatLog from "./chat/ChatLog"
import ChatComposer from "./chat/ChatComposer"
import DiceTray from "./hud/DiceTray"
import type { ChatMessage } from "@/lib/chat-message"
import type { Speaker } from "../hooks/useChat"
import type { User } from "../types/user"
import type { Character } from "../types/character"

interface MiniChatProps {
  messages: ChatMessage[]
  hasMoreMessages: boolean
  onLoadOlderMessages: () => void
  onSendMessage: (content: string, speaker: Speaker) => void
  onRoll: (expression: string) => void
  user: User
  characters: Character[]
  onRequestFullSidebar: () => void
}

function defaultPanelPosition(): { left: number; top: number } {
  if (typeof window === "undefined") return { left: 0, top: 0 }
  const panelW = Math.min(352, window.innerWidth - 24)
  const panelH = Math.min(Math.round(window.innerHeight * 0.42), 448)
  // Just above the bottom HUD (ticker band + panel, about 162px).
  return {
    left: window.innerWidth - panelW - 12,
    top: Math.max(8, window.innerHeight - panelH - 180),
  }
}

function clampPanelPosition(left: number, top: number, panelWidth: number, panelHeight: number): { left: number; top: number } {
  const m = 8
  const maxL = Math.max(m, window.innerWidth - panelWidth - m)
  const maxT = Math.max(m, window.innerHeight - panelHeight - m)
  return {
    left: Math.min(maxL, Math.max(m, left)),
    top: Math.min(maxT, Math.max(m, top)),
  }
}

/** A small floating chat window (when the full sidebar is collapsed). Drag it by its header. */
function MiniChat({
  messages,
  hasMoreMessages,
  onLoadOlderMessages,
  onSendMessage,
  onRoll,
  user,
  characters,
  onRequestFullSidebar,
}: MiniChatProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; originLeft: number; originTop: number } | null>(null)
  const [panelPos, setPanelPos] = useState(defaultPanelPosition)

  const clampToViewport = useCallback(() => {
    const el = panelRef.current
    if (!el) return
    setPanelPos((p) => clampPanelPosition(p.left, p.top, el.offsetWidth, el.offsetHeight))
  }, [])

  useEffect(() => {
    window.addEventListener("resize", clampToViewport)
    return () => window.removeEventListener("resize", clampToViewport)
  }, [clampToViewport])

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    dragRef.current = null
  }

  return (
    <div
      ref={panelRef}
      className="jade jade-marble fixed z-30 flex flex-col p-2 w-[min(22rem,calc(100vw-1.5rem))] h-[min(42vh,28rem)]"
      style={{
        left: panelPos.left,
        top: panelPos.top,
        boxShadow: "0 0 0 2px #0a0d0a, 0 12px 26px rgba(0,0,0,.8), inset 0 0 0 2px #8e9a80, inset 0 0 0 3px #0a0d0a",
      }}
    >
      <div className="jade-well flex min-h-0 flex-1 flex-col">
        <div
          className="flex shrink-0 cursor-grab touch-none select-none items-center gap-2 px-2 py-1.5 active:cursor-grabbing"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            dragRef.current = { startX: e.clientX, startY: e.clientY, originLeft: panelPos.left, originTop: panelPos.top }
          }}
          onPointerMove={(e) => {
            const d = dragRef.current
            const el = panelRef.current
            if (!d || !el) return
            setPanelPos(clampPanelPosition(d.originLeft + e.clientX - d.startX, d.originTop + e.clientY - d.startY, el.offsetWidth, el.offsetHeight))
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="Drag to move"
        >
          <GripVertical className="pointer-events-none h-4 w-4 shrink-0 text-[var(--jade-muted)]" aria-hidden />
          <span className="jade-title pointer-events-none flex-1 truncate text-base leading-none">Chat</span>
          <button
            type="button"
            className="jade-btn !h-6 !px-2 text-xs"
            onClick={onRequestFullSidebar}
            onPointerDown={(e) => e.stopPropagation()}
            title="Open the side panel"
          >
            ‹ Open panel
          </button>
        </div>
        <ChatLog
          messages={messages}
          hasMore={hasMoreMessages}
          onLoadOlder={onLoadOlderMessages}
          className="jade-inset mx-1.5 min-h-0 flex-1 px-2 py-1.5 text-xs"
          compact
        />
        <div className="flex flex-col gap-1.5 p-1.5">
          <DiceTray onRoll={onRoll} compact />
          <ChatComposer user={user} characters={characters} onSend={onSendMessage} compact />
        </div>
      </div>
    </div>
  )
}

export default memo(MiniChat)
