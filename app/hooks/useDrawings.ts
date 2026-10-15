"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Socket } from "socket.io-client"
import { toast } from "@/components/ui/use-toast"
import { api, errorMessage } from "../lib/api"
import type { DrawingObject } from "../components/DrawingLayer"

export type NewDrawingData = Omit<DrawingObject, "id" | "createdAt" | "createdBy" | "sceneId">

/** Freehand drawings on the current scene, stored per drawing and synced live. */
export function useDrawings(sceneId: number | null, socket: Socket | null) {
  const [drawings, setDrawings] = useState<DrawingObject[]>([])
  const sceneIdRef = useRef(sceneId)
  sceneIdRef.current = sceneId

  const load = useCallback(async (id: number | null) => {
    if (!id) {
      setDrawings([])
      return
    }
    try {
      const list = await api<DrawingObject[]>(`/api/drawings?sceneId=${id}`)
      if (sceneIdRef.current === id) setDrawings(Array.isArray(list) ? list : [])
    } catch {
      if (sceneIdRef.current === id) setDrawings([])
    }
  }, [])

  useEffect(() => {
    setDrawings([])
    void load(sceneId)
  }, [sceneId, load])

  useEffect(() => {
    if (!socket) return
    const onAdded = (drawing: DrawingObject) => {
      if (Number(drawing.sceneId) !== sceneIdRef.current) return
      setDrawings((prev) => (prev.some((d) => d.id === drawing.id) ? prev : [...prev, drawing]))
    }
    const onRemoved = (drawingId: string, fromScene: number) => {
      if (Number(fromScene) === sceneIdRef.current) setDrawings((prev) => prev.filter((d) => d.id !== drawingId))
    }
    const onReset = (fromScene: number) => {
      if (Number(fromScene) === sceneIdRef.current) void load(sceneIdRef.current)
    }
    socket.on("drawing_added", onAdded)
    socket.on("drawing_removed", onRemoved)
    socket.on("drawings_reset", onReset)
    return () => {
      socket.off("drawing_added", onAdded)
      socket.off("drawing_removed", onRemoved)
      socket.off("drawings_reset", onReset)
    }
  }, [socket, load])

  const addDrawing = useCallback(async (data: NewDrawingData) => {
    const id = sceneIdRef.current
    if (!id) return
    try {
      const saved = await api<DrawingObject>("/api/drawings", {
        method: "POST",
        // Not crypto.randomUUID(): it only exists on https/localhost, and LAN players use http.
        body: { id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`, path: data.path, color: data.color, sceneId: id },
      })
      setDrawings((prev) => (prev.some((d) => d.id === saved.id) ? prev : [...prev, saved]))
    } catch (error) {
      toast({ title: "Drawing not saved", description: errorMessage(error), variant: "destructive" })
    }
  }, [])

  const deleteDrawings = useCallback(async (ids: string[]) => {
    setDrawings((prev) => prev.filter((d) => !ids.includes(d.id)))
    for (const drawingId of ids) {
      try {
        await api(`/api/drawings?id=${encodeURIComponent(drawingId)}`, { method: "DELETE" })
      } catch (error) {
        toast({ title: "Drawing not deleted", description: errorMessage(error), variant: "destructive" })
      }
    }
  }, [])

  return { drawings, addDrawing, deleteDrawings, reloadDrawings: useCallback(() => load(sceneIdRef.current), [load]) }
}
