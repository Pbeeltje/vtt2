"use client"

import { memo, useCallback, useEffect, useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { clientToGridLogical } from "@/lib/utils"
import { tokenCharacterId, type SceneState } from "@/lib/scene-model"
import type { LayerImage } from "../types/layerImage"
import type { Character } from "../types/character"
import type { DMImage } from "../types/image"
import type { DrawingObject } from "./DrawingLayer"
import DrawingToolbar from "./DrawingToolbar"
import GameGrid from "./main-content/GameGrid"
import ZoomControls from "./main-content/ZoomControls"
import StatusModal from "./main-content/StatusModal"
import TokenSettingsModal, { type TokenSettings } from "./TokenSettingsModal"
import type { DarknessPath } from "./main-content/DarknessLayer"
import type { MapInteractionTool } from "../types/mapTool"
import { isAnyFogTool, isCanvasStrokeTool, isFogCellTool } from "../types/mapTool"
import { useMainContent } from "../hooks/useMainContent"
import { useDragAndDrop } from "../hooks/useDragAndDrop"
import { useDrawing } from "../hooks/useDrawing"
import type { NewDrawingData } from "../hooks/useDrawings"
import type { TextBalloonData } from "../hooks/useChat"
import { useMapNavigation } from "../hooks/map/useMapNavigation"
import { useSelectionBox } from "../hooks/map/useSelectionBox"
import { useMapKeyboard } from "../hooks/map/useMapKeyboard"
import { useItemResize } from "../hooks/map/useItemResize"

type StatusField = "guard" | "strength" | "mp"
const STATUS_COLUMN: Record<StatusField, "Guard" | "Strength" | "Mp"> = { guard: "Guard", strength: "Strength", mp: "Mp" }
const STATUS_MAX: Record<StatusField, "MaxGuard" | "MaxStrength" | "MaxMp"> = { guard: "MaxGuard", strength: "MaxStrength", mp: "MaxMp" }

interface MainContentProps {
  backgroundImage: string | null
  scene: SceneState
  /** Local edit of the scene; the DM's edits are autosaved, players only change their own tokens. */
  onUpdateScene: (updater: (state: SceneState) => SceneState) => void
  currentTool: MapInteractionTool
  onToolChange: (tool: MapInteractionTool) => void
  fogBrushDiameter: number
  onFogBrushDiameterChange: (diameter: number) => void
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
  onPlayerMoveToken: (token: LayerImage) => void
  onPlayerDeleteToken: (tokenId: string) => void
  onOpenCharacterSheet: (character: { CharacterId?: number }) => void
  onUpdateCharacter: (characterId: number, changes: Partial<Character>) => void
  onUploadImage: (category: string, file: File) => Promise<DMImage | null>
  textBalloons: TextBalloonData[]
  onCloseTextBalloon: (balloonId: string) => void
}

function MainContent({
  backgroundImage,
  scene,
  onUpdateScene,
  currentTool,
  onToolChange,
  fogBrushDiameter,
  onFogBrushDiameterChange,
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
  onPlayerMoveToken,
  onPlayerDeleteToken,
  onOpenCharacterSheet,
  onUpdateCharacter,
  onUploadImage,
  textBalloons,
  onCloseTextBalloon,
}: MainContentProps) {
  const isDM = currentUserRole === "DM"
  const { gridSize, gridColor, darknessPaths, isDarknessLayerVisible } = scene
  const middleLayerImages = scene.elements.middleLayer
  const topLayerImages = scene.elements.topLayer

  // --- Scene edits ------------------------------------------------------------------------

  const setLayers = useCallback(
    (middleLayer: LayerImage[], topLayer: LayerImage[]) =>
      onUpdateScene((s) => ({ ...s, elements: { middleLayer, topLayer } })),
    [onUpdateScene]
  )
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
  const setDarknessPaths = useCallback(
    (paths: DarknessPath[]) => onUpdateScene((s) => ({ ...s, darknessPaths: paths })),
    [onUpdateScene]
  )
  const setGridColor = useCallback((color: string) => onUpdateScene((s) => ({ ...s, gridColor: color })), [onUpdateScene])
  const toggleDarknessLayer = useCallback(
    () => onUpdateScene((s) => ({ ...s, isDarknessLayerVisible: !s.isDarknessLayerVisible })),
    [onUpdateScene]
  )

  const {
    gridRef,
    containerRef,
    selectedIds,
    setSelectedIds,
    draggingIds,
    setDraggingIds,
    dragOffset,
    setDragOffset,
    imageDimensions,
    selectedDrawingIds,
    setSelectedDrawingIds,
    statusModal,
    setStatusModal,
    isDrawing,
    setIsDrawing,
    currentPath,
    setCurrentPath,
    generateUniqueId,
    snapToGrid,
    updateItemPosition,
  } = useMainContent({
    backgroundImage,
    middleLayerImages,
    topLayerImages,
    gridSize,
    sceneScale: scene.scale,
    zoomLevel,
    setZoomLevel,
    sceneBorderSize: scene.borderSize,
  })

  const [settingsToken, setSettingsToken] = useState<LayerImage | null>(null)

  // --- Dropping things on the map ---------------------------------------------------------

  /** A token or image dropped from the sidebar. Players' own tokens go through the server. */
  const handleImageDrop = useCallback(
    (item: LayerImage) => {
      if (item.character || item.category === "Token") {
        if (!isDM) {
          if (item.character?.userId !== currentUserId) {
            toast({ title: "Not your character", description: "You can only place your own tokens.", variant: "destructive" })
            return
          }
          onUpdateScene((s) => ({ ...s, elements: { ...s.elements, topLayer: [...s.elements.topLayer, item] } }))
          onPlayerPlaceToken(item)
          return
        }
        onUpdateScene((s) => ({ ...s, elements: { ...s.elements, topLayer: [...s.elements.topLayer, item] } }))
      } else if (isDM) {
        onUpdateScene((s) => ({ ...s, elements: { ...s.elements, middleLayer: [...s.elements.middleLayer, item] } }))
      }
    },
    [isDM, currentUserId, onUpdateScene, onPlayerPlaceToken]
  )

  const { handleDrop, handleDragOver, handleItemDragStart, handleItemDrag, handleItemDragEnd } = useDragAndDrop({
    gridRef,
    gridSize,
    zoomLevel,
    currentSceneId,
    currentUserId,
    currentUserRole,
    middleLayerImages,
    topLayerImages,
    selectedIds,
    setSelectedIds,
    draggingIds,
    setDraggingIds,
    dragOffset,
    setDragOffset,
    generateUniqueId,
    updateItemPosition,
    onUpdateImages: setLayers,
    onPlayerUpdateTokenPosition: onPlayerMoveToken,
    onDrop: handleImageDrop,
  })

  /** Image files dragged in from the computer (DM): upload, then place where dropped. */
  const handleFileDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = isDM ? "copy" : "none"
    },
    [isDM]
  )

  const handleFileDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const file = e.dataTransfer.files?.[0]
      const rect = gridRef.current?.getBoundingClientRect()
      if (!isDM || !file) return
      const point = rect ? clientToGridLogical(e.clientX, e.clientY, rect, zoomLevel) : { x: 0, y: 0 }
      const uploaded = await onUploadImage("Image", file)
      if (!uploaded) return
      const placed: LayerImage = { id: `${uploaded.Id}-${Date.now()}`, url: uploaded.Link, x: point.x, y: point.y, width: 100, height: 100, category: "Image" }
      onUpdateScene((s) => ({ ...s, elements: { ...s.elements, middleLayer: [...s.elements.middleLayer, placed] } }))
      toast({ title: "Image on map", description: `${uploaded.Name ?? "Image"} added to the scene and image list.` })
    },
    [isDM, gridRef, zoomLevel, onUploadImage, onUpdateScene]
  )

  // --- Drawing and fog --------------------------------------------------------------------

  const { startDrawing, draw, endDrawing, handleDrawingClick } = useDrawing({
    gridRef,
    gridSize,
    fogBrushDiameter,
    currentTool,
    currentColor,
    zoomLevel,
    currentSceneId,
    currentUserId,
    currentUserRole,
    isDrawing,
    setIsDrawing,
    currentPath,
    setCurrentPath,
    selectedDrawingIds,
    setSelectedDrawingIds,
    onDrawingAdd,
    darknessPaths,
    onDarknessChange: setDarknessPaths,
  })

  const handleResetDarkness = useCallback(() => {
    if (window.confirm("Reset fog of war? This removes all revealed areas and fills the map with fog again.")) {
      setDarknessPaths([])
    }
  }, [setDarknessPaths])

  const handleDeleteAllDrawings = useCallback(() => {
    if (!isDM) return
    if (drawings.length === 0) {
      toast({ title: "No drawings", description: "There are no drawings on this scene." })
    } else if (window.confirm(`Delete all ${drawings.length} drawings on this scene? This cannot be undone.`)) {
      onDrawingsDelete(drawings.map((d) => d.id))
    }
  }, [isDM, drawings, onDrawingsDelete])

  useEffect(() => {
    if (!isDarknessLayerVisible && isAnyFogTool(currentTool)) onToolChange("cursor")
  }, [isDarknessLayerVisible, currentTool, onToolChange])

  // --- Navigation, selection, resizing ----------------------------------------------------

  const changeGridSize = useCallback(
    (direction: 1 | -1) => {
      const newSize = Math.min(200, Math.max(20, gridSize + direction * 5))
      if (newSize === gridSize) return
      onUpdateScene((s) => ({
        ...s,
        gridSize: newSize,
        elements: { middleLayer: snapToGrid(s.elements.middleLayer, newSize), topLayer: snapToGrid(s.elements.topLayer, newSize) },
      }))
    },
    [gridSize, onUpdateScene, snapToGrid]
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

  const resizeItem = useCallback(
    (id: string, width: number, height: number) => mapItems((item) => (item.id === id ? { ...item, width, height } : item)),
    [mapItems]
  )
  const { resizingId, startResize } = useItemResize({ enabled: isDM, zoomLevel, gridSize, resizeItem })

  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement
      const onItem = target.closest(".token-image, [draggable=\"true\"]")
      if (!onItem && currentTool !== "brush" && !isAnyFogTool(currentTool) && !selection.isSelecting) {
        setSelectedIds([])
        setSelectedDrawingIds([])
      }
    },
    [currentTool, selection.isSelecting, setSelectedIds, setSelectedDrawingIds]
  )

  const handleItemClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => {
      e.stopPropagation()
      if (currentTool === "brush" || isAnyFogTool(currentTool)) return
      if (e.shiftKey) {
        setSelectedIds((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]))
      } else {
        setSelectedIds([item.id])
      }
      setSelectedDrawingIds([])
    },
    [currentTool, setSelectedIds, setSelectedDrawingIds]
  )

  // --- Keyboard: delete and arrow-key nudge -----------------------------------------------

  const canEdit = useCallback(
    (item: LayerImage, isToken: boolean) => isDM || (isToken && item.character?.userId === currentUserId),
    [isDM, currentUserId]
  )

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
  }, [selectedDrawingIds, selectedIds, drawings, topLayerImages, middleLayerImages, isDM, currentUserId, canEdit, onDrawingsDelete, onUpdateScene, onPlayerDeleteToken, setSelectedDrawingIds, setSelectedIds])

  const nudgeSelection = useCallback(
    (dx: number, dy: number): boolean => {
      const movable = [...topLayerImages, ...middleLayerImages].filter(
        (item) => selectedIds.includes(item.id) && canEdit(item, topLayerImages.includes(item))
      )
      if (movable.length === 0) return false
      const ids = movable.map((i) => i.id)
      const { middleLayer, topLayer } = updateItemPosition(ids, dx * gridSize, dy * gridSize)
      setLayers(middleLayer, topLayer)
      if (!isDM) topLayer.filter((t) => ids.includes(t.id)).forEach((t) => onPlayerMoveToken(t))
      return true
    },
    [topLayerImages, middleLayerImages, selectedIds, canEdit, updateItemPosition, gridSize, setLayers, isDM, onPlayerMoveToken]
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

  const handleStatusClick = useCallback(
    (type: StatusField, character: NonNullable<LayerImage["character"]>, characterId: number) => {
      if (!characterId) return
      setStatusModal({
        isOpen: true,
        type,
        currentValue: Number(character[STATUS_COLUMN[type]] ?? 0),
        maxValue: Number(character[STATUS_MAX[type]] ?? 0),
        characterId,
        character,
      })
    },
    [setStatusModal]
  )

  // Saved on the character; the server then refreshes its tokens for everyone.
  const handleStatusUpdate = useCallback(
    (value: number) => {
      if (!statusModal) return
      onUpdateCharacter(statusModal.characterId, { [STATUS_COLUMN[statusModal.type]]: value })
      setStatusModal(null)
    },
    [statusModal, onUpdateCharacter, setStatusModal]
  )

  const handleResizeProp = useCallback(
    (propId: string, factor: number) => {
      const min = Math.floor(gridSize * 0.5)
      const max = Math.floor(gridSize * 4)
      mapItems((item) =>
        item.id !== propId
          ? item
          : {
              ...item,
              width: Math.max(min, Math.min(max, Math.floor((item.width || gridSize) * factor))),
              height: Math.max(min, Math.min(max, Math.floor((item.height || gridSize) * factor))),
            }
      )
    },
    [gridSize, mapItems]
  )

  const handleSaveTokenSettings = useCallback(
    (tokenId: string, settings: TokenSettings) =>
      mapItems((item, isToken) =>
        !isToken || item.id !== tokenId
          ? item
          : {
              ...item,
              width: settings.scale * gridSize,
              height: settings.scale * gridSize,
              auraColor: settings.auraColor ?? undefined,
              auraRadius: settings.auraRadius ?? undefined,
            }
      ),
    [gridSize, mapItems]
  )

  // --- Mouse routing on the grid ----------------------------------------------------------

  const isPaintTool = isCanvasStrokeTool(currentTool) || isFogCellTool(currentTool)

  const handleGridMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPaintTool && e.button === 0 && !e.altKey) {
      startDrawing(e)
      e.stopPropagation()
    } else if (e.button === 0 && !e.altKey) {
      const target = e.target as HTMLElement
      if (!target.closest(".token-image, [draggable=\"true\"], path")) selection.startSelection(e)
    } else {
      navigation.startPan(e)
    }
  }

  const handleGridMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDrawing && isPaintTool) {
      draw(e)
      e.stopPropagation()
    } else if (selection.isSelecting) {
      selection.moveSelection(e)
      e.stopPropagation()
    } else if (navigation.isPanning) {
      navigation.pan(e)
    }
  }

  const handleGridMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDrawing && isPaintTool) {
      endDrawing(e)
      e.stopPropagation()
    } else if (selection.isSelecting) {
      selection.endSelection()
    } else {
      navigation.endPan()
    }
  }

  const handleGridMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDrawing) endDrawing(e)
    else if (selection.isSelecting) selection.endSelection()
    navigation.endPan()
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="flex-grow relative overflow-auto"
        style={{ cursor: navigation.isPanning ? "grabbing" : "grab", userSelect: "none" }}
        onMouseDown={navigation.startPan}
        onMouseMove={navigation.pan}
        onMouseUp={navigation.endPan}
        onMouseLeave={navigation.endPan}
        onDrop={(e) => {
          e.preventDefault()
          handleDrop(e)
        }}
        onDragOver={handleDragOver}
      >
        <div className="absolute top-2 left-2 z-30">
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
          />
          <ZoomControls zoomLevel={zoomLevel} onZoomIn={navigation.zoomIn} onZoomOut={navigation.zoomOut} onZoomReset={navigation.zoomReset} />
        </div>

        <GameGrid
          gridRef={gridRef}
          backgroundImage={backgroundImage}
          imageDimensions={imageDimensions}
          zoomLevel={zoomLevel}
          currentTool={currentTool}
          fogBrushDiameter={fogBrushDiameter}
          gridSize={gridSize}
          gridColor={gridColor}
          sceneBorderSize={scene.borderSize}
          middleLayerImages={middleLayerImages}
          topLayerImages={topLayerImages}
          selectedIds={selectedIds}
          selectedDrawingIds={selectedDrawingIds}
          drawings={drawings}
          isDrawing={isDrawing}
          currentPath={currentPath}
          currentColor={currentColor}
          resizingId={resizingId}
          darknessPaths={darknessPaths}
          isDarknessLayerVisible={isDarknessLayerVisible}
          currentUserRole={currentUserRole}
          isSelecting={selection.isSelecting}
          selectionStart={selection.selectionStart}
          selectionEnd={selection.selectionEnd}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onFileDragOver={handleFileDragOver}
          onFileDrop={handleFileDrop}
          onGridClick={handleGridClick}
          onMouseDown={handleGridMouseDown}
          onMouseMove={handleGridMouseMove}
          onMouseUp={handleGridMouseUp}
          onMouseLeave={handleGridMouseLeave}
          onContextMenu={(e) => e.preventDefault()}
          onItemDragStart={handleItemDragStart}
          onItemDrag={handleItemDrag}
          onItemDragEnd={handleItemDragEnd}
          onItemClick={handleItemClick}
          onResizeStart={(e, item) => startResize(e, item, topLayerImages.some((t) => t.id === item.id))}
          onDrawingClick={handleDrawingClick}
          onTokenDoubleClick={handleTokenDoubleClick}
          onStatusClick={handleStatusClick}
          onDarknessChange={setDarknessPaths}
          onResizeProp={handleResizeProp}
          onOpenTokenSettings={setSettingsToken}
          textBalloons={textBalloons}
          onCloseTextBalloon={onCloseTextBalloon}
        />
      </div>

      <StatusModal
        statusModal={statusModal}
        onClose={() => setStatusModal(null)}
        onUpdate={handleStatusUpdate}
        onValueChange={(value) => setStatusModal((prev) => (prev ? { ...prev, currentValue: value } : null))}
      />

      {settingsToken && (
        <TokenSettingsModal
          key={settingsToken.id}
          token={settingsToken}
          onClose={() => setSettingsToken(null)}
          onSave={handleSaveTokenSettings}
          gridSize={gridSize}
        />
      )}
    </div>
  )
}

export default memo(MainContent)
