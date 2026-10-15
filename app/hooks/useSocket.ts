"use client"

import { useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"

/**
 * One Socket.IO connection for the logged-in user (none while logged out). It reconnects when
 * `sessionKey` changes, because the server reads the session cookie only when a socket connects.
 */
export function useSocket(sessionKey: string | number | null) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (sessionKey === null) return
    const s = io({ withCredentials: true })
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    s.on("connect", onConnect)
    s.on("disconnect", onDisconnect)
    s.on("connect_error", (err) => console.error("Socket.IO: connection error:", err.message))
    setSocket(s)
    return () => {
      s.off("connect", onConnect)
      s.off("disconnect", onDisconnect)
      s.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [sessionKey])

  return { socket, connected }
}

/**
 * Subscribes to a socket event for the lifetime of the component. The handler may change on
 * every render; the latest one is always called.
 */
export function useSocketEvent<Args extends unknown[]>(
  socket: Socket | null,
  event: string,
  handler: (...args: Args) => void
) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  useEffect(() => {
    if (!socket) return
    const listener = (...args: unknown[]) => handlerRef.current(...(args as Args))
    socket.on(event, listener)
    return () => {
      socket.off(event, listener)
    }
  }, [socket, event])
}
