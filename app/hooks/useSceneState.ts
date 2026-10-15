"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Socket } from "socket.io-client"
import { toast } from "@/components/ui/use-toast"
import {
  emptySceneState,
  mergeSceneStates,
  normalizeSceneState,
  parseSceneData,
  sceneContentKey,
  sceneSummary,
  type SceneState,
} from "@/lib/scene-model"
import { api, ApiError, errorMessage } from "../lib/api"
import type { DMImage } from "../types/image"
import type { LayerImage } from "../types/layerImage"
import type { User } from "../types/user"
import { useSocketEvent } from "./useSocket"

/** Edits are saved this long after the last change (a drag sends many changes per second). */
const SAVE_DELAY_MS = 400

type SceneResponse = { sceneId: number; state: SceneState | null }

function savedAt(scene: DMImage): number {
  return scene.SavedAt ? Date.parse(scene.SavedAt) || 0 : 0
}

/** A scene as the lists keep it: the summary of `state` instead of the full SceneData. */
function listEntry(row: DMImage, state: SceneState | null): DMImage {
  const { SceneData: _full, ...rest } = row
  return { ...rest, ...sceneSummary(state) }
}

/**
 * `row` with the summary of `state`, or `row` itself when nothing the lists show changed (so the
 * memoised side panels don't re-render on every autosave). SavedAt only matters for the DM's
 * start scene at login, so it doesn't count as a change.
 */
function withSummary(row: DMImage, state: SceneState | null): DMImage {
  const next = sceneSummary(state)
  const same =
    row.SceneData === undefined &&
    row.HasSceneData === next.HasSceneData &&
    row.Scale === next.Scale &&
    row.BorderSize === next.BorderSize
  return same ? row : listEntry(row, state)
}

/**
 * The loaded scene's map state and how it stays in sync.
 *
 * - `baseRef` is the last version agreed with the server; `scene` is what this client shows.
 * - The DM's edits are saved (debounced) with the base version. If someone else saved first
 *   (a player moved a token), the server answers 409 with its state; we merge and save again.
 * - Remote updates are merged with unsaved local edits instead of replacing them, so applying
 *   them never triggers a save of its own and never drops what the user is doing.
 */
export function useSceneState(user: User | null, socket: Socket | null, connected: boolean) {
  const isDM = user?.role === "DM"
  const [scenes, setScenes] = useState<DMImage[]>([])
  const [selectedScene, setSelectedScene] = useState<DMImage | null>(null)
  const [scene, setScene] = useState<SceneState>(emptySceneState)
  const [activeSceneId, setActiveSceneId] = useState<number | null>(null)

  const sceneIdRef = useRef<number | null>(null)
  const sceneRef = useRef(scene)
  const baseRef = useRef<SceneState | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveChain = useRef<Promise<void>>(Promise.resolve())
  const socketRef = useRef(socket)
  socketRef.current = socket
  const isDMRef = useRef(isDM)
  isDMRef.current = isDM

  const commit = useCallback((next: SceneState) => {
    sceneRef.current = next
    setScene(next)
  }, [])

  /** Applies a local edit. Always computed from the latest state, so quick edits can't overwrite each other. */
  const updateScene = useCallback(
    (updater: (state: SceneState) => SceneState) => {
      const next = updater(sceneRef.current)
      if (next !== sceneRef.current) commit(next)
    },
    [commit]
  )

  /** Keeps the scene lists' summary of `sceneId` in step with a newly saved or received state. */
  const rememberSceneData = useCallback((sceneId: number, state: SceneState | null) => {
    setScenes((prev) => {
      const index = prev.findIndex((s) => s.Id === sceneId)
      if (index === -1) return prev
      const updated = withSummary(prev[index], state)
      return updated === prev[index] ? prev : prev.map((s, i) => (i === index ? updated : s))
    })
    setSelectedScene((prev) => (prev && prev.Id === sceneId ? withSummary(prev, state) : prev))
  }, [])

  /** A newer server state for `sceneId`, merged into the scene if it is the one on screen. */
  const applyServerState = useCallback(
    (sceneId: number, raw: SceneState | null) => {
      rememberSceneData(sceneId, raw)
      if (sceneId !== sceneIdRef.current) return
      if (!raw) {
        const cleared = emptySceneState()
        baseRef.current = cleared
        commit(cleared)
        return
      }
      const remote = normalizeSceneState(raw)
      const base = baseRef.current
      if (base && remote.version <= base.version) return // already have it (or newer)
      baseRef.current = remote
      commit(base ? mergeSceneStates(base, sceneRef.current, remote) : remote)
    },
    [commit, rememberSceneData]
  )

  const saveNow = useCallback(async () => {
    if (!isDMRef.current) return
    const sceneId = sceneIdRef.current
    const base = baseRef.current
    const local = sceneRef.current
    if (!sceneId || !base || local === base || sceneContentKey(local) === sceneContentKey(base)) return
    try {
      const { state } = await api<SceneResponse>("/api/scenes", {
        method: "POST",
        body: { sceneId, sceneData: local, baseVersion: base.version },
        socketId: socketRef.current?.id,
      })
      if (state && sceneIdRef.current === sceneId) {
        baseRef.current = { ...local, version: state.version, savedAt: state.savedAt }
      }
      rememberSceneData(sceneId, state)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.body?.state && sceneIdRef.current === sceneId) {
        // Someone saved first: merge our edits onto their version; the effect below saves again.
        const remote = normalizeSceneState(error.body.state)
        const merged = mergeSceneStates(baseRef.current ?? base, sceneRef.current, remote)
        baseRef.current = remote
        rememberSceneData(sceneId, remote)
        commit(merged)
      } else {
        toast({ title: "Scene not saved", description: errorMessage(error, "Could not save the scene."), variant: "destructive" })
      }
    }
  }, [commit, rememberSceneData])

  /** Saves pending edits now. Saves run one at a time, in order. */
  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    saveChain.current = saveChain.current.then(saveNow)
    return saveChain.current
  }, [saveNow])

  // Debounced autosave of the DM's edits. Remote updates make `scene` equal to (a merge onto)
  // the base, so they only lead to a save when they were merged with real local edits.
  useEffect(() => {
    if (!isDM || !baseRef.current || scene === baseRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void flushSave(), SAVE_DELAY_MS)
  }, [scene, isDM, flushSave])

  // Don't lose the last edit when the tab closes.
  useEffect(() => {
    const onUnload = () => void flushSave()
    window.addEventListener("beforeunload", onUnload)
    return () => window.removeEventListener("beforeunload", onUnload)
  }, [flushSave])

  /**
   * Shows a scene (or nothing). `row` must be a full row (with SceneData, from GET /api/scenes/[id]);
   * list rows only carry a summary. Pending edits of the previous scene are saved first.
   */
  const showScene = useCallback(
    async (row: DMImage | null) => {
      await flushSave()
      const state = row ? parseSceneData(row.SceneData) : emptySceneState()
      sceneIdRef.current = row?.Id ?? null
      baseRef.current = row ? state : null
      commit(state)
      setSelectedScene(row ? listEntry(row, row.SceneData ? state : null) : null)
    },
    [commit, flushSave]
  )

  /** Loads a scene fresh from the server (players may only load the active one). */
  const loadSceneById = useCallback(
    async (sceneId: number) => {
      try {
        const row = await api<DMImage>(`/api/scenes/${sceneId}`)
        const entry = listEntry(row, row.SceneData ? parseSceneData(row.SceneData) : null)
        setScenes((prev) => (prev.some((s) => s.Id === row.Id) ? prev.map((s) => (s.Id === row.Id ? entry : s)) : [...prev, entry]))
        await showScene(row)
      } catch (error) {
        toast({ title: "Scene not loaded", description: errorMessage(error), variant: "destructive" })
      }
    },
    [showScene]
  )

  /** Called once after login: players land on the active scene, the DM too (or their latest save). */
  const initializeScenes = useCallback(
    async (forUser: User) => {
      try {
        const [list, active] = await Promise.all([
          api<DMImage[]>("/api/scenes"),
          api<{ sceneId: number | null }>("/api/scenes/set-active"),
        ])
        setScenes(list)
        setActiveSceneId(active.sceneId)
        const start =
          list.find((s) => s.Id === active.sceneId) ??
          (forUser.role === "DM" ? [...list].filter((s) => s.HasSceneData).sort((a, b) => savedAt(b) - savedAt(a))[0] : undefined)
        // The list only has summaries; load the full map state of the scene to show.
        if (start) await loadSceneById(start.Id)
        else await showScene(null)
      } catch (error) {
        toast({ title: "Scenes not loaded", description: errorMessage(error), variant: "destructive" })
      }
    },
    [showScene, loadSceneById]
  )

  const resetScenes = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    sceneIdRef.current = null
    baseRef.current = null
    commit(emptySceneState())
    setScenes([])
    setSelectedScene(null)
    setActiveSceneId(null)
  }, [commit])

  // Follow the scene's room; after a reconnect, catch up on anything missed while offline.
  useEffect(() => {
    const sceneId = selectedScene?.Id
    if (!socket || !connected || !sceneId) return
    socket.emit("join_scene", String(sceneId))
    api<DMImage>(`/api/scenes/${sceneId}`)
      .then((row) => applyServerState(row.Id, row.SceneData ? parseSceneData(row.SceneData) : null))
      .catch(() => {})
  }, [socket, connected, selectedScene?.Id, applyServerState])

  useSocketEvent<[number, SceneState | null]>(socket, "scene_updated", (sceneId, state) => applyServerState(Number(sceneId), state))

  useSocketEvent<[number]>(socket, "force_scene_change", (rawId) => {
    const sceneId = Number(rawId)
    setActiveSceneId(sceneId)
    if (sceneId !== sceneIdRef.current) void loadSceneById(sceneId)
  })

  // --- DM actions -------------------------------------------------------------------------

  const makeSceneActive = useCallback(async (sceneId: number) => {
    try {
      await api("/api/scenes/set-active", { method: "POST", body: { sceneId } })
    } catch (error) {
      toast({ title: "Could not set active scene", description: errorMessage(error), variant: "destructive" })
    }
  }, [])

  /** Scale and/or border size of any scene; the server moves everything with the map. */
  const updateSceneSettings = useCallback(
    async (sceneId: number, settings: { scale?: number; borderSize?: number }): Promise<boolean> => {
      if (sceneId === sceneIdRef.current) await flushSave()
      try {
        const { state } = await api<SceneResponse>(`/api/scenes/${sceneId}`, {
          method: "PATCH",
          body: settings,
          socketId: socketRef.current?.id,
        })
        applyServerState(sceneId, state)
        return true
      } catch (error) {
        toast({ title: "Scene not updated", description: errorMessage(error), variant: "destructive" })
        return false
      }
    },
    [applyServerState, flushSave]
  )

  /** Removes all saved map data of a scene (tokens, images, fog, grid settings). */
  const clearSceneData = useCallback(
    async (sceneId: number) => {
      try {
        await api("/api/scenes", { method: "POST", body: { sceneId, sceneData: null }, socketId: socketRef.current?.id })
        applyServerState(sceneId, null)
        toast({ title: "Scene data cleared" })
      } catch (error) {
        toast({ title: "Scene data not cleared", description: errorMessage(error), variant: "destructive" })
      }
    },
    [applyServerState]
  )

  // --- Player token actions (players never save the whole scene) --------------------------

  const playerTokenRequest = useCallback(
    async (method: "POST" | "PUT" | "DELETE", body: Record<string, unknown> | null, query = "") => {
      const sceneId = sceneIdRef.current
      if (!sceneId) return
      try {
        const result = await api<SceneResponse>(`/api/scenes/player-token${query}`, {
          method,
          body: body ? { sceneId, ...body } : undefined,
          socketId: socketRef.current?.id,
        })
        // Adopt the server's state as-is: a player's only local edits are these token actions,
        // so nothing local is lost, and no unconfirmed copy lingers to win later merges.
        const remote = result.state ? normalizeSceneState(result.state) : null
        rememberSceneData(result.sceneId, remote)
        if (remote && sceneIdRef.current === result.sceneId && (!baseRef.current || remote.version >= baseRef.current.version)) {
          baseRef.current = remote
          commit(remote)
        }
      } catch (error) {
        // Undo the optimistic local change.
        if (baseRef.current && sceneIdRef.current === sceneId) commit(baseRef.current)
        toast({ title: "Token not saved", description: errorMessage(error), variant: "destructive" })
      }
    },
    [commit, rememberSceneData]
  )

  const playerPlaceToken = useCallback((token: LayerImage) => playerTokenRequest("POST", { tokenData: token }), [playerTokenRequest])
  const playerMoveToken = useCallback(
    (token: LayerImage) => playerTokenRequest("PUT", { tokenData: { id: token.id, x: token.x, y: token.y } }),
    [playerTokenRequest]
  )
  const playerDeleteToken = useCallback(
    (tokenId: string) =>
      playerTokenRequest("DELETE", null, `?sceneId=${sceneIdRef.current}&tokenId=${encodeURIComponent(tokenId)}`),
    [playerTokenRequest]
  )

  return {
    scenes,
    selectedScene,
    scene,
    activeSceneId,
    updateScene,
    initializeScenes,
    resetScenes,
    showScene,
    loadSceneById,
    makeSceneActive,
    updateSceneSettings,
    clearSceneData,
    playerPlaceToken,
    playerMoveToken,
    playerDeleteToken,
  }
}
