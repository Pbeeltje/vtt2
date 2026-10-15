"use client"

import { memo, useEffect, useLayoutEffect, useRef } from "react"
import type { ChatMessage } from "@/lib/chat-message"
import { toPlainText } from "@/lib/chat-text"

interface ChatLogProps {
  messages: ChatMessage[]
  hasMore: boolean
  onLoadOlder: () => void
  className?: string
  compact?: boolean
}

const dateFormat: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }
const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }

function speakerColor(message: ChatMessage): string {
  if (message.type === "system") return "blue"
  if (message.senderType === "character") return "darkgreen"
  if (message.senderRole === "DM") return "red"
  return "black"
}

/** The chat history, newest at the bottom. Stays scrolled to the bottom unless the reader scrolled up. */
function ChatLog({ messages, hasMore, onLoadOlder, className = "", compact = false }: ChatLogProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const previousFirstId = useRef<number | undefined>(undefined)
  const previousHeight = useRef(0)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const firstId = messages[0]?.MessageId
    if (previousFirstId.current !== undefined && firstId !== previousFirstId.current && !stickToBottom.current) {
      // Older messages were added above: keep the same messages in view.
      el.scrollTop += el.scrollHeight - previousHeight.current
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight
    }
    previousFirstId.current = firstId
    previousHeight.current = el.scrollHeight
  }, [messages])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    }
    el.addEventListener("scroll", onScroll)
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  let previousDate = ""
  return (
    <div ref={containerRef} className={`overflow-y-auto ${className}`}>
      <div className={compact ? "space-y-1 pb-1" : "space-y-2 pb-4"}>
        {hasMore && (
          <div className="text-center">
            <button type="button" className="text-xs text-gray-600 underline" onClick={onLoadOlder}>
              Load older messages
            </button>
          </div>
        )}
        {messages.map((message, index) => {
          const date = new Date(message.timestamp)
          const valid = !isNaN(date.getTime())
          const dateText = valid ? date.toLocaleDateString("en-GB", dateFormat) : ""
          const showDate = dateText !== "" && dateText !== previousDate
          if (dateText) previousDate = dateText
          const name = message.type === "system" ? "System" : message.username || "Unknown"
          return (
            <div key={message.MessageId ?? `msg-${index}-${message.timestamp}`}>
              {showDate && (
                <div className={`text-center text-gray-500 ${compact ? "text-[10px] my-1" : "text-sm my-2 pt-2"}`}>{dateText}</div>
              )}
              <div className={compact ? "flex gap-1 leading-snug" : "text-sm flex"}>
                <span className={compact ? "text-[10px] text-gray-500 shrink-0 w-9" : "text-xs text-gray-400 mr-2 self-center min-w-[40px]"}>
                  {valid ? date.toLocaleTimeString("en-GB", timeFormat) : "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <span style={{ color: speakerColor(message), fontWeight: 600 }}>{name}:</span>{" "}
                  <span className={`whitespace-pre-wrap ${message.type === "diceRoll" ? "italic text-stone-800" : ""}`}>
                    {toPlainText(message.content)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default memo(ChatLog)
