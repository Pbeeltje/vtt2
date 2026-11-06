import Image from "next/image"
import { forwardRef, memo, useMemo } from "react"
import { ImageUp } from "lucide-react"
import type { LayerImage } from "../../types/layerImage"
import type { DrawingObject } from "../../types/drawing"
import TokenRenderer, { type TokenHandlers } from "./TokenRenderer"
import DarknessLayer, { type DarknessPath } from "./DarknessLayer"
import TextBalloon from "../TextBalloon"
import PingLayer from "./PingLayer"
import type { MapPing } from "../../hooks/usePings"
import type { TextBalloonData } from "../../hooks/useChat"
import { thumbUrl } from "@/lib/upload-url"
import { useStableCallback } from "../../hooks/useStableCallback"
import type { MapInteractionTool } from "../../types/mapTool"
import { isAnyFogTool, isFogCellTool, isFogStrokeTool } from "../../types/mapTool"
import type { PlayArea, Point } from "../../lib/map-items"
import { MAP_ITEM_ATTR, MAP_Z } from "./map-layers"

/** Size of the map without a background image (fog still needs an area to cover). */
const EMPTY_MAP = { width: 1920, height: 1080 }

const HATCHING = "repeating-linear-gradient(135deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 2px, transparent 2px, transparent 8px)"

interface GameGridProps {
  gridRef: React.RefObject<HTMLDivElement>
  backgroundImage: string | null
  /** The map image plus its border; null while there's no (loaded) background. */
  playArea: PlayArea | null
  zoomLevel: number
  currentTool: MapInteractionTool
  fogBrushDiameter: number
  fogFill: boolean
  gridSize: number
  gridColor: string
  isDM: boolean
  middleLayerImages: LayerImage[]
  topLayerImages: LayerImage[]
  /** Where the items being dragged are shown until they are dropped. */
  dragPositions: ReadonlyMap<string, Point> | null
  selectedIds: string[]
  selectedDrawingIds: string[]
  drawings: DrawingObject[]
  /** The stroke being drawn; useDrawing sets its path data directly, outside React. */
  strokePreviewRef: React.RefObject<SVGPathElement>
  currentColor: string
  darknessPaths: DarknessPath[]
  isDarknessLayerVisible: boolean
  /** The rubber-band selection being dragged, in map pixels. */
  selectionRect: { x: number; y: number; width: number; height: number } | null
  /** An image file is being dragged over the map (DM): show where it goes. */
  isFileOver: boolean
  textBalloons: TextBalloonData[]
  pings: MapPing[]

  onGridClick: (e: React.MouseEvent<HTMLDivElement>) => void
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void
  onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void
  onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => void
  onItemClick: (e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => void
  onResizeStart: (e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => void
  onRotateStart: (e: React.MouseEvent<HTMLElement>, item: LayerImage) => void
  onDrawingClick: (e: React.MouseEvent<SVGPathElement>, drawing: DrawingObject) => void
  onTokenDoubleClick: TokenHandlers["onTokenDoubleClick"]
  onStatusClick: TokenHandlers["onStatusClick"]
  onOpenTokenSettings: TokenHandlers["onOpenTokenSettings"]
}

/** `item` where it is shown: at its drag position while being dragged. */
function shownAt(item: LayerImage, dragPositions: ReadonlyMap<string, Point> | null): LayerImage {
  const p = dragPositions?.get(item.id)
  return p ? { ...item, x: p.x, y: p.y } : item
}

/**
 * The playing field. Layers, bottom to top: the map (background, grid lines, hatched border), map
 * images, tokens, text balloons, drawings, fog of war, pings. The map is drawn at 1:1 scene pixels
 * and scaled by the zoom as a whole, so every layer shares one coordinate space.
 */
export default function GameGrid({
  gridRef,
  backgroundImage,
  playArea,
  zoomLevel,
  currentTool,
  fogBrushDiameter,
  fogFill,
  gridSize,
  gridColor,
  isDM,
  middleLayerImages,
  topLayerImages,
  dragPositions,
  selectedIds,
  selectedDrawingIds,
  drawings,
  strokePreviewRef,
  currentColor,
  darknessPaths,
  isDarknessLayerVisible,
  selectionRect,
  isFileOver,
  textBalloons,
  pings,
  onGridClick,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onItemClick,
  onResizeStart,
  onRotateStart,
  onDrawingClick,
  onTokenDoubleClick,
  onStatusClick,
  onOpenTokenSettings,
}: GameGridProps) {
  // The parent makes new handlers on most renders (every frame of a drag or selection); stable
  // ones let unchanged tokens, images and drawings skip re-rendering.
  const itemClick = useStableCallback(onItemClick)
  const resizeStart = useStableCallback(onResizeStart)
  const rotateStart = useStableCallback(onRotateStart)
  const drawingClick = useStableCallback(onDrawingClick)
  const tokenDoubleClick = useStableCallback(onTokenDoubleClick)
  const statusClick = useStableCallback(onStatusClick)
  const openTokenSettings = useStableCallback(onOpenTokenSettings)

  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const tokens = useMemo(() => topLayerImages.map((t) => shownAt(t, dragPositions)), [topLayerImages, dragPositions])
  const isPainting = currentTool === "brush" || isAnyFogTool(currentTool)

  return (
    <div
      ref={gridRef}
      className="relative"
      style={{
        cursor: dragPositions ? "grabbing" : isPainting ? "crosshair" : "default",
        transform: `scale(${zoomLevel})`,
        transformOrigin: "0 0",
        width: playArea?.width ?? "100%",
        height: playArea?.height ?? "100%",
      }}
      onClick={onGridClick}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MapBackground backgroundImage={backgroundImage} playArea={playArea} gridSize={gridSize} gridColor={gridColor} />

      {isFileOver && isDM && <FileDropHint playArea={playArea} />}

      {middleLayerImages.map((img) => (
        <MapImageItem
          key={img.id}
          img={shownAt(img, dragPositions)}
          gridSize={gridSize}
          selected={selected.has(img.id)}
          canEdit={isDM}
          onItemClick={itemClick}
          onResizeStart={resizeStart}
          onRotateStart={rotateStart}
        />
      ))}

      <TokenRenderer
        tokens={tokens}
        gridSize={gridSize}
        selected={selected}
        onItemClick={itemClick}
        onTokenDoubleClick={tokenDoubleClick}
        onStatusClick={statusClick}
        onOpenTokenSettings={openTokenSettings}
      />

      {textBalloons.map((balloon) => (
        <TextBalloon
          key={balloon.id}
          message={balloon.message}
          x={balloon.x}
          y={balloon.y}
          tokenWidth={balloon.tokenWidth}
        />
      ))}

      {isDarknessLayerVisible && (
        <DarknessLayer
          width={playArea?.width ?? EMPTY_MAP.width}
          height={playArea?.height ?? EMPTY_MAP.height}
          darknessPaths={darknessPaths}
          isDM={isDM}
          zoomLevel={zoomLevel}
        />
      )}

      {selectionRect && (
        <div
          className="pointer-events-none absolute border-2 border-[var(--jade-gold-hi)] bg-[#e0c25a]/15"
          style={{ left: selectionRect.x, top: selectionRect.y, width: selectionRect.width, height: selectionRect.height, zIndex: MAP_Z.selectionBox }}
        />
      )}

      <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: MAP_Z.drawings }}>
        <DrawingPaths drawings={drawings} selectedDrawingIds={selectedDrawingIds} selectable={currentTool === "cursor"} onDrawingClick={drawingClick} />
        {/* The stroke being drawn. No `d` here: useDrawing writes it every frame without re-rendering. */}
        <StrokePreview ref={strokePreviewRef} currentTool={currentTool} currentColor={currentColor} fogBrushDiameter={fogBrushDiameter} fogFill={fogFill} />
      </svg>

      <PingLayer pings={pings} zoomLevel={zoomLevel} />
    </div>
  )
}

/** The map image, the hatched border around it and the grid lines. Only changes with the scene. */
const MapBackground = memo(function MapBackground({
  backgroundImage,
  playArea,
  gridSize,
  gridColor,
}: {
  backgroundImage: string | null
  playArea: PlayArea | null
  gridSize: number
  gridColor: string
}) {
  const borderRects = useMemo(() => {
    if (!playArea || (playArea.borderX === 0 && playArea.borderY === 0)) return []
    const { width, mapWidth, mapHeight, borderX, borderY } = playArea
    return [
      { left: 0, top: 0, width, height: borderY },
      { left: 0, top: borderY + mapHeight, width, height: borderY },
      { left: 0, top: borderY, width: borderX, height: mapHeight },
      { left: borderX + mapWidth, top: borderY, width: borderX, height: mapHeight },
    ]
  }, [playArea])

  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          zIndex: MAP_Z.background,
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : "none",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundClip: "content-box",
          padding: playArea ? `${playArea.borderY}px ${playArea.borderX}px` : 0,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: MAP_Z.gridLines,
          backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
          backgroundSize: `${gridSize}px ${gridSize}px`,
        }}
      />
      {borderRects.map((rect, i) => (
        <div key={i} className="pointer-events-none absolute" style={{ ...rect, zIndex: MAP_Z.border, backgroundImage: HATCHING }} />
      ))}
    </>
  )
})

/** Shown over the map image while the DM drags an image file in from the computer. */
function FileDropHint({ playArea }: { playArea: PlayArea | null }) {
  return (
    <div
      className="pointer-events-none absolute flex items-center justify-center border-2 border-dashed border-[var(--jade-gold-hi)] bg-black/35"
      style={{
        left: playArea?.borderX ?? 0,
        top: playArea?.borderY ?? 0,
        width: playArea?.mapWidth ?? "100%",
        height: playArea?.mapHeight ?? "100%",
        zIndex: MAP_Z.fileDropHint,
      }}
    >
      <div className="jade jade-well jade-fill px-6 py-4 text-center">
        <ImageUp className="mx-auto mb-2 h-7 w-7 text-[var(--jade-gold-hi)] drop-shadow-[1px_1px_0_#000]" aria-hidden />
        <div className="jade-title">Drop image here</div>
        <div className="jade-outline text-sm text-[var(--jade-ink)]">It will be uploaded and placed on the map</div>
      </div>
    </div>
  )
}

interface MapImageItemProps {
  img: LayerImage
  gridSize: number
  selected: boolean
  /** Resize and rotate handles (DM only). */
  canEdit: boolean
  onItemClick: GameGridProps["onItemClick"]
  onResizeStart: GameGridProps["onResizeStart"]
  onRotateStart: GameGridProps["onRotateStart"]
}

/** One middle-layer image; re-renders only when it (or its selection) changes. Moved by useItemDrag. */
const MapImageItem = memo(function MapImageItem({ img, gridSize, selected, canEdit, onItemClick, onResizeStart, onRotateStart }: MapImageItemProps) {
  const width = img.width || gridSize * 2
  const height = img.height || gridSize * 2
  return (
    <div
      {...{ [MAP_ITEM_ATTR]: img.id }}
      className="absolute"
      style={{ left: img.x, top: img.y, zIndex: MAP_Z.image }}
      onClick={(e) => onItemClick(e, img)}
    >
      {/* Everything inside turns with the image, handles included */}
      <div
        data-rotate-box
        className={`relative ${selected ? "outline outline-2 outline-[var(--jade-gold-hi)]" : ""}`}
        style={{
          // No fixed size: the box wraps the image as rendered (its natural aspect ratio),
          // so the outline and the rotation centre match what you see.
          transform: img.rotation ? `rotate(${img.rotation}deg)` : undefined,
          transformOrigin: "center",
        }}
      >
        <Image
          src={thumbUrl(img.url, Math.max(width, height))}
          alt="Map image"
          width={width}
          height={height}
          className="block"
          style={{ objectFit: "contain" }}
          draggable={false}
        />
        {selected && canEdit && (
          <>
            <div
              className="absolute right-1 top-1 z-50 h-2.5 w-2.5 cursor-se-resize border border-[#0a0d0a] bg-[var(--jade-gold-hi)] hover:bg-[#fff3b0]"
              onMouseDown={(e) => onResizeStart(e, img)}
              onClick={(e) => e.stopPropagation()}
              title="Resize image"
            />
            {/* Rotate handle: a stalk above the top edge with a grip at the end */}
            <div className="absolute bottom-full left-1/2 z-50 flex -translate-x-1/2 flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <div
                className="h-3.5 w-3.5 cursor-grab rounded-full border-2 border-[var(--jade-gold-hi)] bg-[#151b14] shadow-[0_0_0_1px_#0a0d0a] hover:bg-[#4a3d14] active:cursor-grabbing"
                onMouseDown={(e) => onRotateStart(e, img)}
                title="Rotate (hold Shift to snap to 15°)"
              />
              <div className="pointer-events-none h-5 w-0.5 bg-[var(--jade-gold-hi)] shadow-[0_0_0_1px_#0a0d0a]" />
            </div>
          </>
        )}
      </div>
    </div>
  )
})

/** Preview colours: fog reveal shows light, fog paint dark, a drawing in its own colour. */
function previewInk(tool: MapInteractionTool, color: string): string {
  if (tool === "darknessEraser" || tool === "darknessEraserCell") return "rgba(255,255,255,0.5)"
  if (tool === "darknessBrush" || tool === "darknessBrushCell") return "rgba(0,0,0,0.4)"
  return color
}

/** The path useDrawing draws the current stroke into. Its `d` is owned by useDrawing, not React. */
const StrokePreview = memo(
  forwardRef<SVGPathElement, { currentTool: MapInteractionTool; currentColor: string; fogBrushDiameter: number; fogFill: boolean }>(function StrokePreview(
    { currentTool, currentColor, fogBrushDiameter, fogFill },
    ref
  ) {
    const ink = previewInk(currentTool, currentColor)
    if (isFogCellTool(currentTool)) {
      return <path ref={ref} fill={ink} stroke="none" style={{ pointerEvents: "none" }} />
    }
    const fogStroke = isFogStrokeTool(currentTool)
    return (
      <path
        ref={ref}
        stroke={ink}
        strokeWidth={fogStroke ? fogBrushDiameter : 3}
        // With Fill on, the open loop is filled as if closed: exactly the area the stroke will cover.
        fill={fogStroke && fogFill ? ink : "none"}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ pointerEvents: "none" }}
      />
    )
  })
)

/** The saved drawings; skipped while only the stroke being drawn changes. */
const DrawingPaths = memo(function DrawingPaths({
  drawings,
  selectedDrawingIds,
  selectable,
  onDrawingClick,
}: {
  drawings: DrawingObject[]
  selectedDrawingIds: string[]
  selectable: boolean
  onDrawingClick: GameGridProps["onDrawingClick"]
}) {
  return (
    <>
      {drawings.map((drawing) => {
        const isSelected = selectedDrawingIds.includes(drawing.id)
        return (
          <path
            key={drawing.id}
            d={drawing.path}
            stroke={isSelected ? "#e0c25a" : drawing.color}
            strokeWidth={isSelected ? 5 : 3}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
            onClick={(e) => onDrawingClick(e, drawing)}
            className={selectable ? "cursor-pointer" : ""}
            style={{ pointerEvents: selectable ? "stroke" : "none" }}
          />
        )
      })}
    </>
  )
})
