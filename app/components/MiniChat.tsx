"use client"

import { memo, useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { GripVertical, PanelLeft } from "lucide-react"
import ChatLog from "./chat/ChatLog"
import ChatComposer from "./chat/ChatComposer"
import type { ChatMessage } from "@/lib/chat-message"
import type { Speaker } from "../hooks/useChat"
import type { User } from "../types/user"
import type { Character } from "../types/character"

interface MiniChatProps {
  messages: ChatMessage[]
  hasMoreMessages: boolean
  onLoadOlderMessages: () => void
  onSendMessage: (content: string, speaker: Speaker) => void
  user: User
  chatBackgroundColor: string
  characters: Character[]
  onRequestFullSidebar: () => void
}

function defaultPanelPosition(): { left: number; top: number } {
  if (typeof window === "undefined") return { left: 0, top: 0 }
  const panelW = Math.min(352, window.innerWidth - 24)
  const panelH = Math.min(Math.round(window.innerHeight * 0.42), 448)
  return {
    left: window.innerWidth - panelW - 12,
    top: window.innerHeight - panelH - 96,
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
  user,
  chatBackgroundColor,
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
      className="fixed z-30 flex flex-col rounded-lg border border-stone-400 bg-stone-100 shadow-lg w-[min(22rem,calc(100vw-1.5rem))] h-[min(42vh,28rem)]"
      style={{
        left: panelPos.left,
        top: panelPos.top,
        backgroundImage: 'url("images/rightsidemenu.jpeg")',
        backgroundSize: "100% auto",
        backgroundRepeat: "repeat-y",
      }}
    >
      <div
        className="flex items-center gap-2 border-b border-stone-400/80 px-2 py-1.5 bg-stone-300/90 cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
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
        <GripVertical className="h-4 w-4 text-stone-500 shrink-0 pointer-events-none" aria-hidden />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 flex-shrink-0 bg-stone-200 cursor-pointer"
          onClick={onRequestFullSidebar}
          onPointerDown={(e) => e.stopPropagation()}
          title="Open full sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs font-semibold text-stone-800 truncate pointer-events-none">Chat</span>
      </div>
      <ChatLog
        messages={messages}
        hasMore={hasMoreMessages}
        onLoadOlder={onLoadOlderMessages}
        className={`flex-1 min-h-0 px-2 py-1.5 text-xs ${chatBackgroundColor} bg-opacity-90`}
        compact
      />
      <div className="border-t border-stone-400/80 p-1.5 bg-stone-300/90">
        <ChatComposer user={user} characters={characters} onSend={onSendMessage} compact />
      </div>
    </div>
  )
}

export default memo(MiniChat)
