import Image from "next/image"
import type { LayerImage } from "../../types/layerImage"
import type { DrawingObject } from '../DrawingLayer'
import TokenRenderer from "./TokenRenderer"
import DarknessLayer, { type DarknessPath } from "./DarknessLayer"
import { useState } from "react"

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
  onFileDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
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
  onFileDragOver,
  onFileDrop,
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
  const [isDraggingFile, setIsDraggingFile] = useState(false)

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
        onDragOver={(e) => {
          e.preventDefault();
          console.log('[GameGrid] Drag over event');
          // Handle both image drops and file drops
          onDragOver(e);
          onFileDragOver?.(e);
          
          // Check if this is a file drag
          const files = e.dataTransfer.files;
          if (files && files.length > 0) {
            setIsDraggingFile(true);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          console.log('[GameGrid] Drop event triggered');
          // Check if this is a file drop (from file explorer) or image drop (from UI)
          const files = e.dataTransfer.files;
          const imageId = e.dataTransfer.getData("imageId");
          const category = e.dataTransfer.getData("category");
          const url = e.dataTransfer.getData("image-url");
          const isExistingItem = e.dataTransfer.getData("isExistingItem");
          
          console.log('[GameGrid] Drop data:', { imageId, category, url, filesCount: files?.length || 0, isExistingItem });
          
          // If this is an existing item being dragged around, ignore the drop
          // (the position update is handled by the drag handlers)
          if (isExistingItem === "true") {
            console.log('[GameGrid] Ignoring drop - existing item being moved');
            return;
          }
          
          // If we have data transfer data (from UI drag), treat as UI image drop
          // Even if there are files, prioritize the data transfer data
          if (imageId || category || url) {
            console.log('[GameGrid] Calling onDrop for UI image');
            setIsDraggingFile(false);
            onDrop(e);
          } else if (files && files.length > 0) {
            // This is a file drop from file explorer (no data transfer data)
            console.log('[GameGrid] Calling onFileDrop for file upload');
            setIsDraggingFile(false);
            onFileDrop?.(e);
          } else {
            // This is likely just dragging an existing image around
            console.log('[GameGrid] Ignoring drop - no files or data transfer data');
          }
        }}
        onDragLeave={(e) => {
          // Only set to false if we're leaving the entire grid area
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDraggingFile(false);
          }
        }}
        onClick={onGridClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onContextMenu={onContextMenu}
      >
        {/* File drag overlay */}
        {isDraggingFile && (
          <div className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg">
              <div className="text-center">
                <div className="text-2xl mb-2">📁</div>
                <div className="font-semibold text-blue-700">Drop image here</div>
                <div className="text-sm text-gray-600">Image will be uploaded and placed on the map</div>
              </div>
            </div>
          </div>
        )}
        
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
            {/* Resize handle - only show when selected */}
            {selectedIds.includes(img.id) && (
              <div 
                className="absolute top-1 right-1 w-2 h-2 bg-blue-500 hover:bg-blue-600 cursor-se-resize z-50 rounded-sm border border-white transition-colors duration-150"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onResizeStart(e, img);
                }}
                onClick={(e) => e.stopPropagation()}
                draggable={false}
                title="Resize image"
              />
            )}
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