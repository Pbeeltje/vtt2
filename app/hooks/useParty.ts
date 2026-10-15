"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Socket } from "socket.io-client"
import { api } from "../lib/api"
import type { User } from "../types/user"
import { useSocketEvent } from "./useSocket"

/** What the party row shows about each Party character (see /api/party). */
export interface PartyMember {
  CharacterId: number
  Name: string
  Path?: string
  PortraitUrl?: string | null
  TokenUrl?: string | null
  Guard?: number | null
  MaxGuard?: number | null
  Mp?: number | null
  MaxMp?: number | null
  userId: number
  ownerUsername?: string | null
}

/** Every Party character, refetched whenever the server says a character changed. */
export function useParty(user: User | null, socket: Socket | null, connected: boolean) {
  const [party, setParty] = useState<PartyMember[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      setParty(await api<PartyMember[]>("/api/party"))
    } catch {
      /* the row keeps what it had; the next change or reconnect tries again */
    }
  }, [])

  // On login, and again after a reconnect to catch up on changes missed while offline.
  useEffect(() => {
    if (!user) setParty([])
    else if (connected) void load()
  }, [user, connected, load])

  // A burst of edits (typing in a sheet) becomes one refetch.
  useSocketEvent(socket, "party_changed", () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void load(), 250)
  })

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  return party
}
