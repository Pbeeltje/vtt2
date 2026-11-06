"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { confirm } from "@/components/ui/confirm-dialog"
import { clientToGridLogical } from "@/lib/utils"
import { tokenCharacterId, type SceneState } from "@/lib/scene-model"
import type { LayerImage } from "../types/layerImage"
import type { Character } from "../types/character"
import type { DMImage } from "../types/image"
import type { DarknessPath, DrawingObject } from "../types/drawing"
import type { MapInteractionTool } from "../types/mapTool"
import { isAnyFogTool, isCanvasStrokeTool, isFogCellTool } from "../types/mapTool"
import DrawingToolbar from "./DrawingToolbar"
import GameGrid from "./main-content/GameGrid"
import ZoomControls from "./main-content/ZoomControls"
import StatusModal, { type StatusModalState } from "./main-content/StatusModal"
import type { StatusField } from "./main-content/TokenRenderer"
import { mapItemIdAt } from "./main-content/map-layers"
import TokenSettingsModal, { type TokenSettings } from "./TokenSettingsModal"
import { useDrawing } from "../hooks/useDrawing"
import type { NewDrawingData } from "../hooks/useDrawings"
import type { TextBalloonData } from "../hooks/useChat"
import type { MapPing } from "../hooks/usePings"
import { useMapNavigation } from "../hooks/map/useMapNavigation"
import { useSelectionBox } from "../hooks/map/useSelectionBox"
import { useMapKeyboard } from "../hooks/map/useMapKeyboard"
import { useItemResize } from "../hooks/map/useItemResize"
import { useItemRotate } from "../hooks/map/useItemRotate"
import { useItemDrag } from "../hooks/map/useItemDrag"
import { isSwallowedClick } from "../hooks/map/clickGuard"
import { useMapDrop } from "../hooks/map/useMapDrop"
import { usePlayArea } from "../hooks/map/usePlayArea"
import { fitToGrid, movedPosition, withPositions, type PlacedItem, type Point } from "../lib/map-items"
import type { TokenCharacter } from "../lib/tokens"

const STATUS_COLUMN: Record<StatusField, "Guard" | "Strength" | "Mp"> = { guard: "Guard", strength: "Strength", mp: "Mp" }
const STATUS_MAX: Record<StatusField, "MaxGuard" | "MaxStrength" | "MaxMp"> = { guard: "MaxGuard", strength: "MaxStrength", mp: "MaxMp" }

/** Grid size limits and step (Shift+wheel, DM). */
const GRID_SIZE_MIN = 20
const GRID_SIZE_MAX = 200
const GRID_SIZE_STEP = 5

/** Drawings can be clicked (selected) too; a press on one isn't a press on empty map. */
const isOnMapThing = (target: EventTarget | null) => mapItemIdAt(target) !== null || (target as Element | null)?.closest?.("path") != null

interface MainContentProps {
  backgroundImage: string | null
  scene: SceneState
  /** Local edit of the scene; the DM's edits are autosaved, players only change their own tokens. */
  onUpdateScene: (updater: (state: SceneState) => SceneState) => void
  currentTool: MapInteractionTool
  onToolChange: (tool: MapInteractionTool) => void
  fogBrushDiameter: number
  onFogBrushDiameterChange: (diameter: number) => void
  fogFill: boolean
  onFogFillChange: (fill: boolean) => void
  currentColor: string
  onColorChange: (color: string) => void
  zoomLevel: number
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>
  currentSceneId: number | null
  currentUserId: number
  currentUserRole: string
  drawings: DrawingObject[]
  onDrawingAdd: (data: NewDrawingData) => void
  onDrawingsDelete: (ids: string[]) => void
  onPlayerPlaceToken: (token: LayerImage) => void
  /** A player's own tokens moved (saved by the server, all in one request). */
  onPlayerMoveTokens: (moves: Array<{ id: string; x: number; y: number }>) => void
  onPlayerDeleteToken: (tokenId: string) => void
  onOpenCharacterSheet: (character: { CharacterId?: number }) => void
  onUpdateCharacter: (characterId: number, changes: Partial<Character>) => void
  onUploadImage: (category: string, file: File) => Promise<DMImage | null>
  textBalloons: TextBalloonData[]
  pings: MapPing[]
  /** Shift+click on an empty spot: ping there, in map coordinates. */
  onPing: (x: number, y: number) => void
  /** The one character among the selected tokens, or null (none, or several). */
  onSelectedCharacterChange?: (characterId: number | null) => void
}

/**
 * The map screen: the playing field (GameGrid) with its toolbars, and everything you do on it with
 * the mouse and keyboard. Each interaction lives in its own hook; this component routes the mouse
 * to them and turns their results into scene edits.
 */
function MainContent({
  backgroundImage,
  scene,
  onUpdateScene,
  currentTool,
  onToolChange,
  fogBrushDiameter,
  onFogBrushDiameterChange,
  fogFill,
  onFogFillChange,
  currentColor,
  onColorChange,
  zoomLevel,
  setZoomLevel,
  currentSceneId,
  currentUserId,
  currentUserRole,
  drawings,
  onDrawingAdd,
  onDrawingsDelete,
  onPlayerPlaceToken,
  onPlayerMoveTokens,
  onPlayerDeleteToken,
  onOpenCharacterSheet,
  onUpdateCharacter,
  onUploadImage,
  textBalloons,
  pings,
  onPing,
  onSelectedCharacterChange,
}: MainContentProps) {
  const isDM = currentUserRole === "DM"
  const { gridSize, gridColor, darknessPaths, isDarknessLayerVisible } = scene
  const middleLayerImages = scene.elements.middleLayer
  const topLayerImages = scene.elements.topLayer

  const gridRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<string[]>([])
  const [statusModal, setStatusModal] = useState<StatusModalState | null>(null)
  const [settingsToken, setSettingsToken] = useState<LayerImage | null>(null)

  const playArea = usePlayArea(backgroundImage, scene.scale, scene.borderSize)

  // --- Scene edits ------------------------------------------------------------------------

  /** Changes items by id using the latest state (safe for several quick edits in a row). */
  const mapItems = useCallback(
    (fn: (item: LayerImage, isToken: boolean) => LayerImage) =>
      onUpdateScene((s) => ({
        ...s,
        elements: {
          middleLayer: s.elements.middleLayer.map((i) => fn(i, false)),
          topLayer: s.elements.topLayer.map((i) => fn(i, true)),
        },
      })),
    [onUpdateScene]
  )
  const setDarknessPaths = useCallback((paths: DarknessPath[]) => onUpdateScene((s) => ({ ...s, darknessPaths: paths })), [onUpdateScene])
  const setGridColor = useCallback((color: string) => onUpdateScene((s) => ({ ...s, gridColor: color })), [onUpdateScene])
  const toggleDarknessLayer = useCallback(
    () => onUpdateScene((s) => ({ ...s, isDarknessLayerVisible: !s.isDarknessLayerVisible })),
    [onUpdateScene]
  )

  /** Who may change an item: the DM anything, a player only their own character tokens. */
  const canEdit = useCallback(
    (item: LayerImage, isToken: boolean) => isDM || (isToken && item.character?.userId === currentUserId),
    [isDM, currentUserId]
  )

  /**
   * Moves items to new positions in one scene update. The DM's moves are autosaved; a player's go to
   * the server (only their own tokens ever get here).
   */
  const moveItems = useCallback(
    (positions: Map<string, Point>, moved: PlacedItem[]) => {
      onUpdateScene((s) => ({
        ...s,
        elements: { middleLayer: withPositions(s.elements.middleLayer, positions), topLayer: withPositions(s.elements.topLayer, positions) },
      }))
      if (!isDM) {
        onPlayerMoveTokens(moved.filter((m) => m.isToken).map(({ item }) => ({ id: item.id, ...positions.get(item.id)! })))
      }
    },
    [onUpdateScene, isDM, onPlayerMoveTokens]
  )

  // --- Things dropped on the map ----------------------------------------------------------

  const placeItem = useCallback(
    (item: LayerImage, layer: "top" | "middle") =>
      onUpdateScene((s) => ({
        ...s,
        elements:
          layer === "top"
            ? { ...s.elements, topLayer: [...s.elements.topLayer, item] }
            : { ...s.elements, middleLayer: [...s.elements.middleLayer, item] },
      })),
    [onUpdateScene]
  )

  const drop = useMapDrop({
    gridRef,
    zoomLevel,
    gridSize,
    isDM,
    currentUserId,
    currentSceneId,
    onPlace: placeItem,
    onPlayerPlaceToken,
    onUploadImage,
  })

  // --- Drawing and fog --------------------------------------------------------------------

  /** A finished fog stroke: appended to the latest fog in one update. */
  const addDarknessOps = useCallback(
    (ops: DarknessPath[]) => onUpdateScene((s) => ({ ...s, darknessPaths: [...s.darknessPaths, ...ops] })),
    [onUpdateScene]
  )

  const { previewRef: strokePreviewRef, startDrawing, handleDrawingClick } = useDrawing({
    gridRef,
    gridSize,
    fogBrushDiameter,
    fogFill,
    currentTool,
    currentColor,
    zoomLevel,
    currentSceneId,
    currentUserId,
    currentUserRole,
    setSelectedDrawingIds,
    onDrawingAdd,
    onDarknessAdd: addDarknessOps,
  })

  const handleResetDarkness = useCallback(async () => {
    const ok = await confirm({ title: "Reset fog of war?", description: "This removes all revealed areas and fills the map with fog again.", confirmLabel: "Reset fog", destructive: true })
    if (ok) setDarknessPaths([])
  }, [setDarknessPaths])

  const handleDeleteAllDrawings = useCallback(async () => {
    if (!isDM) return
    if (drawings.length === 0) {
      toast({ title: "No drawings", description: "There are no drawings on this scene." })
    } else if (await confirm({ title: `Delete all ${drawings.length} drawings?`, description: "Every drawing on this scene goes. This cannot be undone.", confirmLabel: "Delete all", destructive: true })) {
      onDrawingsDelete(drawings.map((d) => d.id))
    }
  }, [isDM, drawings, onDrawingsDelete])

  useEffect(() => {
    if (!isDarknessLayerVisible && isAnyFogTool(currentTool)) onToolChange("cursor")
  }, [isDarknessLayerVisible, currentTool, onToolChange])

  // --- Navigation, selection, moving, resizing --------------------------------------------

  const changeGridSize = useCallback(
    (direction: 1 | -1) => {
      const newSize = Math.min(GRID_SIZE_MAX, Math.max(GRID_SIZE_MIN, gridSize + direction * GRID_SIZE_STEP))
      if (newSize === gridSize) return
      onUpdateScene((s) => ({
        ...s,
        gridSize: newSize,
        elements: {
          middleLayer: fitToGrid(s.elements.middleLayer, s.gridSize, newSize),
          topLayer: fitToGrid(s.elements.topLayer, s.gridSize, newSize),
        },
      }))
    },
    [gridSize, onUpdateScene]
  )

  const navigation = useMapNavigation({
    containerRef,
    gridRef,
    zoomLevel,
    setZoomLevel,
    onGridSizeWheel: isDM ? changeGridSize : undefined,
  })

  const selection = useSelectionBox({
    gridRef,
    zoomLevel,
    gridSize,
    middleLayerImages,
    topLayerImages,
    drawings,
    currentUserRole,
    currentUserId,
    setSelectedIds,
    setSelectedDrawingIds,
  })

  const { dragPositions, startItemDrag } = useItemDrag({
    gridRef,
    zoomLevel,
    gridSize,
    middleLayerImages,
    topLayerImages,
    selectedIds,
    setSelectedIds,
    canMove: canEdit,
    onMove: moveItems,
  })

  const resizeItem = useCallback(
    (id: string, width: number, height: number) => mapItems((item) => (item.id === id ? { ...item, width, height } : item)),
    [mapItems]
  )
  const { startResize } = useItemResize({ enabled: isDM, zoomLevel, gridSize, resizeItem })

  const rotateItem = useCallback(
    (id: string, rotation: number) => mapItems((item) => (item.id === id ? { ...item, rotation } : item)),
    [mapItems]
  )
  const { startRotate } = useItemRotate({ enabled: isDM, rotateItem })

  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isSwallowedClick()) return
      if (!mapItemIdAt(e.target) && !e.shiftKey && currentTool !== "brush" && !isAnyFogTool(currentTool)) {
        setSelectedIds([])
        setSelectedDrawingIds([])
      }
    },
    [currentTool]
  )

  const handleItemClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => {
      e.stopPropagation()
      if (isSwallowedClick() || currentTool === "brush" || isAnyFogTool(currentTool)) return
      if (e.shiftKey) {
        setSelectedIds((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]))
      } else {
        setSelectedIds([item.id])
      }
      setSelectedDrawingIds([])
    },
    [currentTool]
  )

  // --- The round menu acts for the selected token's character ----------------------------

  const selectedCharacterId = useMemo(() => {
    const ids = new Set(topLayerImages.filter((t) => selectedIds.includes(t.id)).map(tokenCharacterId).filter((id): id is number => id !== null))
    return ids.size === 1 ? [...ids][0] : null
  }, [topLayerImages, selectedIds])
  useEffect(() => onSelectedCharacterChange?.(selectedCharacterId), [selectedCharacterId, onSelectedCharacterChange])

  // --- Keyboard: delete and arrow-key nudge -----------------------------------------------

  const deleteSelection = useCallback((): boolean => {
    if (selectedDrawingIds.length > 0) {
      const mine = drawings.filter((d) => selectedDrawingIds.includes(d.id) && (isDM || d.createdBy === currentUserId))
      if (mine.length < selectedDrawingIds.length) {
        toast({ title: "Permission denied", description: "You can only delete your own drawings.", variant: "destructive" })
      }
      if (mine.length > 0) onDrawingsDelete(mine.map((d) => d.id))
      setSelectedDrawingIds([])
      setSelectedIds([])
      return true
    }
    if (selectedIds.length === 0) return false

    const tokens = topLayerImages.filter((t) => selectedIds.includes(t.id))
    const images = middleLayerImages.filter((i) => selectedIds.includes(i.id))
    const allowedTokens = tokens.filter((t) => canEdit(t, true))
    const allowedImages = images.filter((i) => canEdit(i, false))
    if (allowedTokens.length + allowedImages.length < tokens.length + images.length) {
      toast({ title: "Permission denied", description: "You can only delete your own tokens.", variant: "destructive" })
    }
    const removed = new Set([...allowedTokens, ...allowedImages].map((i) => i.id))
    onUpdateScene((s) => ({
      ...s,
      elements: {
        middleLayer: s.elements.middleLayer.filter((i) => !removed.has(i.id)),
        topLayer: s.elements.topLayer.filter((t) => !removed.has(t.id)),
      },
    }))
    if (!isDM) allowedTokens.forEach((t) => onPlayerDeleteToken(t.id))
    setSelectedIds([])
    return true
  }, [selectedDrawingIds, selectedIds, drawings, topLayerImages, middleLayerImages, isDM, currentUserId, canEdit, onDrawingsDelete, onUpdateScene, onPlayerDeleteToken])

  const nudgeSelection = useCallback(
    (dx: number, dy: number): boolean => {
      const movable: PlacedItem[] = [
        ...topLayerImages.map((item) => ({ item, isToken: true })),
        ...middleLayerImages.map((item) => ({ item, isToken: false })),
      ].filter(({ item, isToken }) => selectedIds.includes(item.id) && canEdit(item, isToken))
      if (movable.length === 0) return false
      const positions = new Map(movable.map((m) => [m.item.id, movedPosition(m, dx * gridSize, dy * gridSize, gridSize)]))
      moveItems(positions, movable)
      return true
    },
    [topLayerImages, middleLayerImages, selectedIds, canEdit, gridSize, moveItems]
  )

  useMapKeyboard({ onDelete: deleteSelection, onNudge: nudgeSelection })

  // --- Token actions: sheet, status values, settings --------------------------------------

  const handleTokenDoubleClick = useCallback(
    (item: LayerImage) => {
      const characterId = tokenCharacterId(item)
      if (!characterId || !item.character) return
      if (isDM || item.character.userId === currentUserId) {
        onOpenCharacterSheet({ CharacterId: characterId })
      } else {
        toast({ title: "Permission denied", description: "You can only view your own characters.", variant: "destructive" })
      }
    },
    [isDM, currentUserId, onOpenCharacterSheet]
  )

  const handleStatusClick = useCallback((type: StatusField, character: TokenCharacter, characterId: number) => {
    if (!characterId) return
    setStatusModal({
      type,
      characterId,
      characterName: character.Name,
      current: Number(character[STATUS_COLUMN[type]] ?? 0),
      max: Number(character[STATUS_MAX[type]] ?? 0),
    })
  }, [])

  // Saved on the character; the server then refreshes its tokens for everyone.
  const handleStatusUpdate = useCallback(
    (value: number) => {
      if (!statusModal) return
      onUpdateCharacter(statusModal.characterId, { [STATUS_COLUMN[statusModal.type]]: value })
      setStatusModal(null)
    },
    [statusModal, onUpdateCharacter]
  )

  const handleSaveTokenSettings = useCallback(
    (tokenId: string, settings: TokenSettings) =>
      mapItems((item, isToken) =>
        !isToken || item.id !== tokenId
          ? item
          : {
              ...item,
              ...(settings.scale !== undefined && { width: settings.scale * gridSize, height: settings.scale * gridSize }),
              auraColor: settings.auraColor ?? undefined,
              auraRadius: settings.auraRadius ?? undefined,
              statusEffect: settings.statusEffect ?? undefined,
            }
      ),
    [gridSize, mapItems]
  )

  // --- Mouse routing on the grid ----------------------------------------------------------
  // Left button: Shift on empty map pings; paint tools draw (over items too); on an item it
  // picks the item up; on empty map it starts a selection box. Other buttons and Alt+drag pan,
  // which the scroll container handles as the event bubbles up to it.

  const isPaintTool = isCanvasStrokeTool(currentTool) || isFogCellTool(currentTool)

  const handleGridMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.altKey) return
    if (e.shiftKey && !isOnMapThing(e.target)) {
      const rect = gridRef.current?.getBoundingClientRect()
      if (rect) {
        const point = clientToGridLogical(e.clientX, e.clientY, rect, zoomLevel)
        onPing(point.x, point.y)
      }
      e.stopPropagation()
      return
    }
    if (isPaintTool) {
      startDrawing(e)
      e.stopPropagation()
      return
    }
    const itemId = mapItemIdAt(e.target)
    if (itemId) startItemDrag(e, itemId)
    else if (!isOnMapThing(e.target)) selection.startSelection(e)
  }

  const handleGridMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selection.isSelecting) return
    selection.moveSelection(e)
    e.stopPropagation()
  }

  const endSelection = () => {
    if (selection.isSelecting) selection.endSelection()
  }

  const { selectionStart: a, selectionEnd: b } = selection
  const selectionRect =
    selection.isSelecting && a && b ? { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) } : null

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#050403]">
      <div
        ref={containerRef}
        className="relative grow overflow-auto"
        style={{ cursor: navigation.isPanning ? "grabbing" : "grab", userSelect: "none" }}
        onMouseDown={navigation.startPan}
        onMouseMove={navigation.pan}
        onMouseUp={navigation.endPan}
        onMouseLeave={navigation.endPan}
        onDragOver={drop.onDragOver}
        onDragLeave={drop.onDragLeave}
        onDrop={drop.onDrop}
      >
        <div className="fixed left-4 top-4 z-30">
          <ZoomControls zoomLevel={zoomLevel} onZoomIn={navigation.zoomIn} onZoomOut={navigation.zoomOut} onZoomReset={navigation.zoomReset} />
          <DrawingToolbar
            currentTool={currentTool}
            onToolChange={onToolChange}
            currentColor={currentColor}
            onColorChange={onColorChange}
            gridColor={gridColor}
            onGridColorChange={setGridColor}
            currentUserRole={currentUserRole}
            onDeleteAllDrawings={handleDeleteAllDrawings}
            isDarknessLayerVisible={isDarknessLayerVisible}
            onToggleDarknessLayer={toggleDarknessLayer}
            onResetDarkness={handleResetDarkness}
            fogBrushDiameter={fogBrushDiameter}
            onFogBrushDiameterChange={onFogBrushDiameterChange}
            fogFill={fogFill}
            onFogFillChange={onFogFillChange}
          />
        </div>

        <GameGrid
          gridRef={gridRef}
          backgroundImage={backgroundImage}
          playArea={playArea}
          zoomLevel={zoomLevel}
          currentTool={currentTool}
          fogBrushDiameter={fogBrushDiameter}
          fogFill={fogFill}
          gridSize={gridSize}
          gridColor={gridColor}
          isDM={isDM}
          middleLayerImages={middleLayerImages}
          topLayerImages={topLayerImages}
          dragPositions={dragPositions}
          selectedIds={selectedIds}
          selectedDrawingIds={selectedDrawingIds}
          drawings={drawings}
          strokePreviewRef={strokePreviewRef}
          currentColor={currentColor}
          darknessPaths={darknessPaths}
          isDarknessLayerVisible={isDarknessLayerVisible}
          selectionRect={selectionRect}
          isFileOver={drop.isFileOver}
          textBalloons={textBalloons}
          pings={pings}
          onGridClick={handleGridClick}
          onMouseDown={handleGridMouseDown}
          onMouseMove={handleGridMouseMove}
          onMouseUp={endSelection}
          onMouseLeave={endSelection}
          onItemClick={handleItemClick}
          onResizeStart={(e, item) => startResize(e, item, topLayerImages.some((t) => t.id === item.id))}
          onRotateStart={startRotate}
          onDrawingClick={handleDrawingClick}
          onTokenDoubleClick={handleTokenDoubleClick}
          onStatusClick={handleStatusClick}
          onOpenTokenSettings={setSettingsToken}
        />
      </div>

      <StatusModal state={statusModal} onClose={() => setStatusModal(null)} onSave={handleStatusUpdate} />

      {settingsToken && (
        <TokenSettingsModal key={settingsToken.id} token={settingsToken} onClose={() => setSettingsToken(null)} onSave={handleSaveTokenSettings} gridSize={gridSize} />
      )}
    </div>
  )
}

export default memo(MainContent)
