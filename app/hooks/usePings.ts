"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Socket } from "socket.io-client"
import type { User } from "../types/user"
import { toast } from "@/components/ui/use-toast"
import { newPingLimitState, tryPing, PING_MUTE_MS } from "@/lib/ping-limit"
import { useSocketEvent } from "./useSocket"

export interface MapPing {
  id: string
  x: number
  y: number
  color: string
  /** Shown next to other players' pings; null for your own. */
  username: string | null
}

/** How long a ping ring stays on the map (matches the CSS animation). */
const PING_LIFETIME_MS = 1800

let audioContext: AudioContext | null = null

/** A soft two-note chime, made on the fly so there is no sound file to ship. */
function playPingSound() {
  try {
    audioContext ??= new AudioContext()
    const ctx = audioContext
    if (ctx.state === "suspended") void ctx.resume()
    const start = ctx.currentTime
    for (const [frequency, delay, peak] of [
      [660, 0, 0.07],
      [990, 0.09, 0.05],
    ] as const) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0, start + delay)
      gain.gain.linearRampToValueAtTime(peak, start + delay + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.7)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start + delay)
      osc.stop(start + delay + 0.75)
    }
  } catch {
    /* no audio available */
  }
}

/** Map pings on the current scene: yours (shift+click) and everyone else's. */
export function usePings(socket: Socket | null, sceneId: number | null, user: User | null) {
  const [pings, setPings] = useState<MapPing[]>([])
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  // Mirrors the server's limit (lib/ping-limit.ts), so you never see a ping the others don't.
  const limit = useRef(newPingLimitState())

  const show = useCallback((ping: Omit<MapPing, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setPings((prev) => [...prev, { ...ping, id }])
    playPingSound()
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setPings((prev) => prev.filter((p) => p.id !== id))
    }, PING_LIFETIME_MS)
    timers.current.add(timer)
  }, [])

  useEffect(() => setPings([]), [sceneId])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  useSocketEvent<[{ sceneId: number; x: number; y: number; color: string; username: string }]>(socket, "map_ping", (ping) => {
    if (ping.sceneId !== sceneId) return
    show({ x: ping.x, y: ping.y, color: ping.color, username: ping.username })
  })

  const ping = useCallback(
    (x: number, y: number) => {
      if (!socket || sceneId === null) return
      const { allowed, muted } = tryPing(limit.current, Date.now())
      if (!allowed) return
      if (muted) toast({ title: "Pings paused", description: `That's a lot of pings. You can ping again in ${PING_MUTE_MS / 1000} seconds.` })
      show({ x, y, color: user?.color ?? "#ffffff", username: null })
      socket.emit("map_ping", { sceneId: String(sceneId), x, y })
    },
    [socket, sceneId, user?.color, show]
  )

  return { pings, ping }
}
