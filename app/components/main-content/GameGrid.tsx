import Image from "next/image"
import type { LayerImage } from "../../types/layerImage"
import type { DrawingObject } from '../DrawingLayer'
import TokenRenderer from "./TokenRenderer"
import DarknessLayer, { type DarknessPath } from "./DarknessLayer"
import TextBalloon from "../TextBalloon"
import { useState, useCallback } from "react"

interface GameGridProps {
  gridRef: React.RefObject<HTMLDivElement>;
  backgroundImage: string | null;
  imageDimensions: { width: number; height: number } | null;
  zoomLevel: number;
  currentTool: 'brush' | 'cursor' | 'darknessEraser' | 'darknessBrush';
  gridSize: number;
  gridColor: string;
  sceneBorderSize?: number;
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
  // Text balloon props
  textBalloons?: Array<{
    id: string;
    message: string;
    characterName: string;
    x: number;
    y: number;
    tokenWidth: number;
    tokenHeight: number;
    timestamp: number;
  }>;
  onCloseTextBalloon?: (balloonId: string) => void;
}

export default function GameGrid({
  gridRef,
  backgroundImage,
  imageDimensions,
  zoomLevel,
  currentTool,
  gridSize,
  gridColor,
  sceneBorderSize = 0.2,
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
  textBalloons = [],
  onCloseTextBalloon,
}: GameGridProps) {
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  // Calculate border dimensions
  const borderWidth = imageDimensions ? Math.round(imageDimensions.width * sceneBorderSize) : 0;
  const borderHeight = imageDimensions ? Math.round(imageDimensions.height * sceneBorderSize) : 0;
  
  // Calculate total play area dimensions (image + borders)
  const totalWidth = imageDimensions ? imageDimensions.width + (borderWidth * 2) : 0;
  const totalHeight = imageDimensions ? imageDimensions.height + (borderHeight * 2) : 0;

  return (
    <div
      ref={gridRef}
      className="relative"
      style={{
        cursor: currentTool === "brush" || currentTool === "darknessEraser" || currentTool === "darknessBrush" ? "crosshair" : "default",
        transform: `scale(${zoomLevel})`,
        transformOrigin: "0 0",
        width: totalWidth || "100%",
        height: totalHeight || "100%",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        console.log('GameGrid onDragOver:', {
          files: e.dataTransfer.files?.length || 0,
          types: e.dataTransfer.types,
          hasJsonData: e.dataTransfer.types.includes('application/json')
        });
        
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
        // Check if this is a file drop (from file explorer) or image drop (from UI)
        const files = e.dataTransfer.files;
        const jsonData = e.dataTransfer.getData("application/json");
        const isExistingItem = e.dataTransfer.getData("isExistingItem");
        
        console.log('GameGrid onDrop:', {
          files: files?.length || 0,
          jsonData,
          isExistingItem,
          hasJsonData: !!jsonData
        });
        
        // If this is an existing item being dragged around, ignore the drop
        // (the position update is handled by the drag handlers)
        if (isExistingItem === "true") {
          console.log('Ignoring existing item drop');
          return;
        }
        
        // If we have JSON data (from UI drag), treat as UI image drop
        // Even if there are files, prioritize the JSON data
        if (jsonData) {
          console.log('Handling JSON data drop');
          setIsDraggingFile(false);
          onDrop(e);
        } else if (files && files.length > 0 && onFileDrop) {
          // This is a file drop from file explorer (no JSON data)
          console.log('Handling file drop');
          setIsDraggingFile(false);
          onFileDrop(e);
        } else {
          console.log('No valid drop data found');
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
      {/* Background image container - covers entire play area (image + borders) */}
      <div
        className="absolute"
        style={{
          width: totalWidth || "100%",
          height: totalHeight || "100%",
          left: 0,
          top: 0,
          zIndex: 3,
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : "none",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundClip: "content-box",
          padding: `${borderHeight}px ${borderWidth}px`,
        }}
      >
        {/* File drag overlay - only shows on the main image area */}
        {isDraggingFile && (
          <div 
            className="absolute bg-blue-500/20 border-2 border-dashed border-blue-500 flex items-center justify-center z-50 pointer-events-none"
            style={{
              left: 0,
              top: 0,
              width: imageDimensions?.width || "100%",
              height: imageDimensions?.height || "100%",
            }}
          >
            <div className="bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg">
              <div className="text-center">
                <div className="text-2xl mb-2">📁</div>
                <div className="font-semibold text-blue-700">Drop image here</div>
                <div className="text-sm text-gray-600">Image will be uploaded and placed on the map</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid overlay - covers the entire play area, on top of background */}
      <div
        className="absolute pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          width: totalWidth || "100%",
          height: totalHeight || "100%",
          left: 0,
          top: 0,
          zIndex: 5,
        }}
      />

      {/* Hatching overlay for border area (all four sides) */}
      {imageDimensions && (borderWidth > 0 || borderHeight > 0) && (
        <>
          {/* Top border */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: 0,
              top: 0,
              width: totalWidth,
              height: borderHeight,
              zIndex: 10,
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 2px, transparent 2px, transparent 8px)',
            }}
          />
          {/* Bottom border */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: 0,
              top: borderHeight + imageDimensions.height,
              width: totalWidth,
              height: borderHeight,
              zIndex: 10,
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 2px, transparent 2px, transparent 8px)',
            }}
          />
          {/* Left border */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: 0,
              top: borderHeight,
              width: borderWidth,
              height: imageDimensions.height,
              zIndex: 10,
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 2px, transparent 2px, transparent 8px)',
            }}
          />
          {/* Right border */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: borderWidth + imageDimensions.width,
              top: borderHeight,
              width: borderWidth,
              height: imageDimensions.height,
              zIndex: 10,
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 2px, transparent 2px, transparent 8px)',
            }}
          />
        </>
      )}
      
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

      {/* Text balloons - Above tokens */}
      {textBalloons.map((balloon) => (
        <TextBalloon
          key={balloon.id}
          message={balloon.message}
          x={balloon.x}
          y={balloon.y}
          tokenWidth={balloon.tokenWidth}
          tokenHeight={balloon.tokenHeight}
          onClose={() => onCloseTextBalloon?.(balloon.id)}
        />
      ))}

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
  )
} 