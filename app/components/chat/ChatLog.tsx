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

// Combat-log colours on the jade panel: characters in yellow-green, the DM in ember, system lines in gold.
function speakerColor(message: ChatMessage): string {
  if (message.type === "system") return "var(--jade-gold-hi)"
  if (message.senderType === "character") return "var(--jade-name)"
  if (message.senderRole === "DM") return "var(--jade-hit)"
  return "var(--jade-ink-hi)"
}

/** A dice line with its result in a box: a test's pass/fail, otherwise the total it ends with. */
function DiceText({ text }: { text: string }) {
  const match = /(?:pass|fail|-?\d+)$/.exec(text)
  const head = match ? text.slice(0, match.index) : text
  return (
    <span className="whitespace-pre-wrap text-[var(--jade-roll)]">
      {head}
      {match && (
        <strong className="ml-0.5 inline-block rounded-[3px] border border-black bg-[#efe6cf] px-1.5 text-[1.15em] leading-[1.15] text-black tabular-nums [text-shadow:none] shadow-[0_1px_2px_rgba(0,0,0,.6)]">
          {match[0]}
        </strong>
      )}
    </span>
  )
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
            <button type="button" className="text-xs text-[var(--jade-muted)] underline hover:text-[var(--jade-ink)]" onClick={onLoadOlder}>
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
                <div className={`jade-sc text-center text-[var(--jade-muted)] ${compact ? "text-[10px] my-1" : "text-xs my-2 pt-1"}`}>— {dateText} —</div>
              )}
              <div className={compact ? "flex gap-1 leading-snug text-[var(--jade-ink)]" : "flex text-[15px] leading-[1.25] text-[var(--jade-ink)]"}>
                <span className={compact ? "text-[10px] text-[var(--jade-ink)] [text-shadow:0_1px_2px_#000] shrink-0 w-9 pt-px" : "text-[11px] text-[var(--jade-muted)] [text-shadow:0_1px_2px_#000] mr-2 pt-[3px] min-w-[36px] tabular-nums"}>
                  {valid ? date.toLocaleTimeString("en-GB", timeFormat) : "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <span style={{ color: speakerColor(message), fontWeight: 600 }}>{name}:</span>{" "}
                  {message.type === "diceRoll" ? (
                    <DiceText text={toPlainText(message.content)} />
                  ) : (
                    <span className="whitespace-pre-wrap">{toPlainText(message.content)}</span>
                  )}
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
