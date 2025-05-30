import Image from "next/image"
import type { LayerImage } from "../../types/layerImage"
import type { DrawingObject } from '../DrawingLayer'
import TokenRenderer from "./TokenRenderer"
import DarknessLayer, { type DarknessPath } from "./DarknessLayer"

interface GameGridProps {
  gridRef: React.RefObject<HTMLDivElement>;
  backgroundImage: string | null;
  imageDimensions: { width: number; height: number } | null;
  zoomLevel: number;
  currentTool: 'brush' | 'cursor' | 'darknessEraser' | 'darknessBrush';
  gridSize: number;
  gridColor: string;
  middleLayerImages: LayerImage[];
  topLayerImages: LayerImage[];
  selectedIds: string[];
  selectedDrawingIds: string[];
  drawings: DrawingObject[];
  isDrawing: boolean;
  currentPath: string;
  currentColor: string;
  resizingId: string | null;
  // Darkness layer props
  darknessPaths: DarknessPath[];
  isDarknessLayerVisible: boolean;
  currentUserRole?: string | null;
  // Selection box props
  isSelecting?: boolean;
  selectionStart?: { x: number; y: number } | null;
  selectionEnd?: { x: number; y: number } | null;
  
  // Event handlers
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onGridClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => void;
  onContextMenu: (e: React.MouseEvent<HTMLDivElement>) => void;
  onItemDragStart: (e: React.DragEvent<HTMLDivElement>, item: LayerImage, isToken: boolean) => void;
  onItemDrag: (e: React.DragEvent<HTMLDivElement>) => void;
  onItemDragEnd: () => void;
  onItemClick: (e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => void;
  onResizeStart: (e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => void;
  onDrawingClick: (e: React.MouseEvent<SVGPathElement>, drawing: DrawingObject) => void;
  onTokenDoubleClick: (item: LayerImage) => void;
  onStatusClick: (type: 'guard' | 'strength' | 'mp', character: any, characterId: number) => void;
  onDarknessChange: (paths: DarknessPath[]) => void;
  onResizeProp: (propId: string, scale: number) => void;
}

export default function GameGrid({
  gridRef,
  backgroundImage,
  imageDimensions,
  zoomLevel,
  currentTool,
  gridSize,
  gridColor,
  middleLayerImages,
  topLayerImages,
  selectedIds,
  selectedDrawingIds,
  drawings,
  isDrawing,
  currentPath,
  currentColor,
  resizingId,
  darknessPaths,
  isDarknessLayerVisible,
  currentUserRole,
  isSelecting,
  selectionStart,
  selectionEnd,
  onDragOver,
  onDrop,
  onGridClick,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onContextMenu,
  onItemDragStart,
  onItemDrag,
  onItemDragEnd,
  onItemClick,
  onResizeStart,
  onDrawingClick,
  onTokenDoubleClick,
  onStatusClick,
  onDarknessChange,
  onResizeProp,
}: GameGridProps) {
  return (
    <div
      ref={gridRef}
      className="relative"
      style={{
        cursor: currentTool === "brush" || currentTool === "darknessEraser" || currentTool === "darknessBrush" ? "crosshair" : "default",
        transform: `scale(${zoomLevel})`,
        transformOrigin: "0 0",
        width: imageDimensions?.width || "100%",
        height: imageDimensions?.height || "100%",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : "none",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          width: "100%",
          height: "100%",
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={onGridClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onContextMenu={onContextMenu}
      >
        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            width: "100%",
            height: "100%",
          }}
        />
        
        {/* Middle layer images */}
        {middleLayerImages.map((img) => (
          <div
            key={img.id}
            className={`absolute ${selectedIds.includes(img.id) ? "border-2 border-blue-500" : ""}`}
            style={{ left: img.x, top: img.y, zIndex: 35 }}
            draggable={true}
            onDragStart={(e) => onItemDragStart(e, img, false)}
            onDrag={onItemDrag}
            onDragEnd={onItemDragEnd}
            onClick={(e) => onItemClick(e, img)}
          >
            <Image 
              src={img.url} 
              alt="Middle layer image" 
              width={img.width || gridSize * 2} 
              height={img.height || gridSize * 2} 
              style={{ objectFit: 'contain' }} 
            />
            {/* Resize handle */}
            <div 
              className="absolute bottom-0 right-0 w-4 h-4 bg-gray-500 cursor-se-resize" 
              onMouseDown={(e) => onResizeStart(e, img)} 
            />
          </div>
        ))}
        
        {/* Top layer tokens */}
        <TokenRenderer
          tokens={topLayerImages}
          gridSize={gridSize}
          selectedIds={selectedIds}
          onItemDragStart={onItemDragStart}
          onItemDrag={onItemDrag}
          onItemDragEnd={onItemDragEnd}
          onItemClick={onItemClick}
          onTokenDoubleClick={onTokenDoubleClick}
          onStatusClick={onStatusClick}
          onResizeProp={onResizeProp}
        />

        {/* Darkness Layer - Above tokens, below drawings */}
        {isDarknessLayerVisible && (
          <DarknessLayer
            width={imageDimensions?.width || 1920}
            height={imageDimensions?.height || 1080}
            darknessPaths={darknessPaths}
            isVisible={isDarknessLayerVisible}
            currentUserRole={currentUserRole}
          />
        )}
        
        {/* Selection box overlay */}
        {isSelecting && selectionStart && selectionEnd && (
          <div
            className="absolute border-2 border-blue-500 bg-blue-200/20 pointer-events-none"
            style={{
              left: Math.min(selectionStart.x, selectionEnd.x),
              top: Math.min(selectionStart.y, selectionEnd.y),
              width: Math.abs(selectionEnd.x - selectionStart.x),
              height: Math.abs(selectionEnd.y - selectionStart.y),
              zIndex: 35,
            }}
          />
        )}
        
        {/* Drawing layer - Above darkness layer */}
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 40, pointerEvents: 'none' }}>
          {/* Regular drawings */}
          {drawings.map((drawing) => (
            <path
              key={drawing.id}
              d={drawing.path}
              stroke={selectedDrawingIds.includes(drawing.id) ? "blue" : drawing.color}
              strokeWidth={selectedDrawingIds.includes(drawing.id) ? "5" : "3"}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
              onClick={(e) => onDrawingClick(e, drawing)}
              className={`${currentTool === 'cursor' ? 'cursor-pointer' : ''}`}
              style={{ pointerEvents: currentTool === 'cursor' ? 'stroke' : 'none' }}
            />
          ))}
          
          {/* Current drawing path preview */}
          {isDrawing && currentPath && (
            <path 
              d={currentPath} 
              stroke={
                currentTool === 'darknessEraser' ? 'rgba(255,255,255,0.5)' :
                currentTool === 'darknessBrush' ? 'rgba(0,0,0,0.4)' :
                currentColor
              }
              strokeWidth={
                currentTool === 'darknessEraser' || currentTool === 'darknessBrush' ? "50" : "3"
              }
              fill="none" 
              strokeLinejoin="round" 
              strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>
      </div>
    </div>
  )
} 