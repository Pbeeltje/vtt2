"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GripVertical, PanelLeft } from "lucide-react"
import type { User } from "../types/user"
import type { Character } from "../types/character"

interface ChatMessage {
  MessageId?: number
  type: string
  content: string
  timestamp: string
  username: string
  senderType?: "user" | "character"
  senderRole?: string
  UserId?: number
}

interface MiniChatProps {
  messages: ChatMessage[]
  addMessage: (type: string, content: string, speakerName: string, senderType: "user" | "character") => void | Promise<void>
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

function clampPanelPosition(
  left: number,
  top: number,
  panelWidth: number,
  panelHeight: number
): { left: number; top: number } {
  const m = 8
  const maxL = Math.max(m, window.innerWidth - panelWidth - m)
  const maxT = Math.max(m, window.innerHeight - panelHeight - m)
  return {
    left: Math.min(maxL, Math.max(m, left)),
    top: Math.min(maxT, Math.max(m, top)),
  }
}

export default function MiniChat({
  messages,
  addMessage,
  user,
  chatBackgroundColor,
  characters,
  onRequestFullSidebar,
}: MiniChatProps) {
  const [inputMessage, setInputMessage] = useState("")
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; originLeft: number; originTop: number } | null>(null)
  const [panelPos, setPanelPos] = useState(defaultPanelPosition)
  const [selectedSpeaker, setSelectedSpeaker] = useState<{ name: string; type: "user" | "character" }>({
    name: user.username,
    type: "user",
  })

  useEffect(() => {
    setSelectedSpeaker({ name: user.username, type: "user" })
  }, [user.username])

  useEffect(() => {
    const scrollToBottom = () => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
      }
    }
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(scrollToBottom)
    }, 100)
    return () => clearTimeout(timeoutId)
  }, [messages])

  const clampToViewport = useCallback(() => {
    const el = panelRef.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    setPanelPos((p) => clampPanelPosition(p.left, p.top, w, h))
  }, [])

  useEffect(() => {
    window.addEventListener("resize", clampToViewport)
    return () => window.removeEventListener("resize", clampToViewport)
  }, [clampToViewport])

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      void addMessage("user", inputMessage, selectedSpeaker.name, selectedSpeaker.type)
      setInputMessage("")
    }
  }

  const filteredCharsForDropdown = characters.filter((char) => char.userId === user.id)

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
          ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
          dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            originLeft: panelPos.left,
            originTop: panelPos.top,
          }
        }}
        onPointerMove={(e) => {
          const d = dragRef.current
          if (!d) return
          const el = panelRef.current
          if (!el) return
          const dx = e.clientX - d.startX
          const dy = e.clientY - d.startY
          const next = clampPanelPosition(
            d.originLeft + dx,
            d.originTop + dy,
            el.offsetWidth,
            el.offsetHeight
          )
          setPanelPos(next)
        }}
        onPointerUp={(e) => {
          if (dragRef.current) {
            ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
            dragRef.current = null
          }
        }}
        onPointerCancel={(e) => {
          if (dragRef.current) {
            try {
              ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
            } catch {
              /* ignore */
            }
            dragRef.current = null
          }
        }}
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
      <div
        ref={chatContainerRef}
        className={`flex-1 min-h-0 overflow-y-auto px-2 py-1.5 text-xs ${chatBackgroundColor} bg-opacity-90`}
      >
        <div className="space-y-1 pb-1">
          {messages.map((message, index) => {
            const messageDate = new Date(message.timestamp)
            let formattedTime = "—"
            let currentDateString = ""

            if (!isNaN(messageDate.getTime())) {
              formattedTime = messageDate.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })
              currentDateString = messageDate.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            }

            const prevMessage = index > 0 ? messages[index - 1] : null
            let prevDateString: string | null = null
            if (prevMessage) {
              const prevMessageDate = new Date(prevMessage.timestamp)
              if (!isNaN(prevMessageDate.getTime())) {
                prevDateString = prevMessageDate.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
              }
            }

            const showDateSeparator =
              currentDateString && (!prevDateString || currentDateString !== prevDateString)

            const key =
              message.MessageId !== undefined ? message.MessageId : `msg-${index}-${message.timestamp}`

            let usernameColor = "black"
            if (message.type === "system") {
              usernameColor = "blue"
            } else if (message.senderType === "character") {
              usernameColor = "darkgreen"
            } else if (message.senderRole === "DM") {
              usernameColor = "red"
            }

            return (
              <div key={key}>
                {showDateSeparator && (
                  <div className="text-center text-[10px] text-gray-500 my-1">{currentDateString}</div>
                )}
                <div className="flex gap-1 leading-snug">
                  <span className="text-[10px] text-gray-500 shrink-0 w-9">{formattedTime}</span>
                  <div className="min-w-0 flex-1">
                    {message.type === "user" || message.type === "diceRoll" ? (
                      <span style={{ color: usernameColor, fontWeight: 600 }}>{message.username}:</span>
                    ) : message.type === "system" ? (
                      <span style={{ color: usernameColor, fontWeight: 600 }}>System:</span>
                    ) : (
                      <span style={{ color: usernameColor, fontWeight: 600 }}>
                        {message.username || "Unknown"}:
                      </span>
                    )}{" "}
                    <span
                      className={message.type === "diceRoll" ? "italic text-stone-800" : ""}
                      dangerouslySetInnerHTML={{ __html: message.content }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="border-t border-stone-400/80 p-1.5 bg-stone-300/90">
        <div className="flex flex-col gap-1.5">
          <select
            value={`${selectedSpeaker.type}-${selectedSpeaker.name}`}
            onChange={(e) => {
              const raw = e.target.value
              const i = raw.indexOf("-")
              const type = (i >= 0 ? raw.slice(0, i) : raw) as "user" | "character"
              const name = i >= 0 ? raw.slice(i + 1) : ""
              setSelectedSpeaker({ name, type })
            }}
            className="w-full p-1.5 text-xs border rounded-md bg-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Speak as"
          >
            <option value={`user-${user.username}`}>{user.username} (You)</option>
            {filteredCharsForDropdown.map((char) => (
              <option key={char.CharacterId} value={`character-${char.Name}`}>
                {char.Name} (Character)
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            <Input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Message…"
              className="flex-1 h-8 text-xs bg-stone-200"
            />
            <Button type="button" size="sm" className="h-8 px-2 text-xs shrink-0" onClick={handleSendMessage}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
