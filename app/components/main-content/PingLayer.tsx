"use client"

import { memo } from "react"
import type { MapPing } from "../../hooks/usePings"

/** Expanding rings where someone shift+clicked, in their colour. Sized to look the same at any zoom. */
function PingLayer({ pings, zoomLevel }: { pings: MapPing[]; zoomLevel: number }) {
  const scale = 1 / (zoomLevel || 1)
  return (
    <>
      {pings.map((ping) => (
        <div
          key={ping.id}
          className="pointer-events-none absolute"
          style={{ left: ping.x, top: ping.y, zIndex: 45, transform: `scale(${scale})`, transformOrigin: "0 0" }}
        >
          {[0, 0.25, 0.5].map((delay) => (
            <span
              key={delay}
              className="vtt-ping-ring absolute -left-10 -top-10 h-20 w-20 rounded-full"
              style={{ borderColor: ping.color, boxShadow: `0 0 12px ${ping.color}`, animationDelay: `${delay}s` }}
            />
          ))}
          <span className="vtt-ping-dot absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full" style={{ background: ping.color }} />
          {ping.username && (
            <span className="jade-outline absolute left-4 top-3 whitespace-nowrap text-xs font-semibold" style={{ color: ping.color }}>
              {ping.username}
            </span>
          )}
        </div>
      ))}
    </>
  )
}

export default memo(PingLayer)
