import Image from "next/image"
import { Plus, Minus } from "lucide-react"
import type { LayerImage } from "../../types/layerImage"

interface TokenRendererProps {
  tokens: LayerImage[];
  gridSize: number;
  selectedIds: string[];
  onItemDragStart: (e: React.DragEvent<HTMLDivElement>, item: LayerImage, isToken: boolean) => void;
  onItemDrag: (e: React.DragEvent<HTMLDivElement>) => void;
  onItemDragEnd: () => void;
  onItemClick: (e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => void;
  onTokenDoubleClick: (item: LayerImage) => void;
  onStatusClick: (type: 'guard' | 'strength' | 'mp', character: any, characterId: number) => void;
  onResizeProp?: (propId: string, scale: number) => void;
}

export default function TokenRenderer({
  tokens,
  gridSize,
  selectedIds,
  onItemDragStart,
  onItemDrag,
  onItemDragEnd,
  onItemClick,
  onTokenDoubleClick,
  onStatusClick,
  onResizeProp,
}: TokenRendererProps) {
  return (
    <>
      {tokens.map((img) => (
        <div
          key={img.id}
          className={`absolute ${selectedIds.includes(img.id) ? "border-2 border-blue-500" : ""}`}
          style={{ left: img.x, top: img.y, zIndex: 30 }}
          draggable={true}
          onDragStart={(e) => onItemDragStart(e, img, true)}
          onDrag={onItemDrag}
          onDragEnd={onItemDragEnd}
          onClick={(e) => onItemClick(e, img)}
          onDoubleClick={() => onTokenDoubleClick(img)}
        >
          <div className="relative">
            <Image 
              src={img.url} 
              alt="Token" 
              width={img.width || gridSize} 
              height={img.height || gridSize} 
              style={{ objectFit: 'contain' }} 
              className="token-image" 
            />
            
            {/* Resize Controls - Show when selected */}
            {selectedIds.includes(img.id) && onResizeProp && (
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 flex gap-1 z-40">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResizeProp(img.id, 0.5); // Make 50% smaller
                  }}
                  className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg"
                  title="Make 50% smaller"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResizeProp(img.id, 1.5); // Make 50% larger
                  }}
                  className="w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg"
                  title="Make 50% larger"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
            
            {selectedIds.includes(img.id) && img.character && (
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap" style={{ zIndex: 30 }}>
                <span 
                  className="text-sm font-semibold text-black" 
                  style={{ 
                    textShadow: `-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white` 
                  }}
                >
                  {img.character.Name}
                </span>
              </div>
            )}
          </div>
          
          {/* Status Circles */}
          {selectedIds.includes(img.id) && img.character && (
            <div className="status-circles-container absolute -top-12 left-0 right-0 flex justify-center space-x-3" style={{ zIndex: 50 }}>
              {/* Guard Circle */}
              <div className="status-circle guard-circle relative bg-white rounded-full p-1">
                <div 
                  className="w-8 h-8 rounded-full border-2 border-green-500 flex items-center justify-center text-sm cursor-pointer hover:bg-green-50"
                  onClick={() => onStatusClick('guard', img.character, img.characterId!)}
                >
                  {img.character.Guard}/{img.character.MaxGuard}
                </div>
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">
                  Gd
                </div>
              </div>
              
              {/* Strength Circle */}
              <div className="status-circle strength-circle relative bg-white rounded-full p-1">
                <div 
                  className="w-8 h-8 rounded-full border-2 border-red-500 flex items-center justify-center text-sm cursor-pointer hover:bg-red-50"
                  onClick={() => onStatusClick('strength', img.character, img.characterId!)}
                >
                  {img.character.Strength}/{img.character.MaxStrength}
                </div>
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">
                  Str
                </div>
              </div>
              
              {/* MP Circle (only for Magic Users) */}
              {img.character.Path === "Magic User" && (
                <div className="status-circle mp-circle relative bg-white rounded-full p-1">
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center text-sm cursor-pointer hover:bg-blue-50"
                    onClick={() => onStatusClick('mp', img.character, img.characterId!)}
                  >
                    {img.character.Mp}/{img.character.MaxMp}
                  </div>
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">
                    Mp
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  )
} 