"use client"

import { useEffect, useState } from "react"
import type { Socket } from "socket.io-client"
import type { PlayerProfile } from "@/lib/player-profile"
import { useSocketEvent } from "./useSocket"

export type { PlayerProfile }

/** Who is logged in to the table right now. The server sends the whole list on every change. */
export function usePresence(socket: Socket | null) {
  const [online, setOnline] = useState<PlayerProfile[]>([])
  useEffect(() => {
    if (!socket) setOnline([])
  }, [socket])
  useSocketEvent<[PlayerProfile[]]>(socket, "presence", (list) => setOnline(Array.isArray(list) ? list : []))
  return online
}
