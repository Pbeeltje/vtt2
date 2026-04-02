import { useState, useRef, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { Brush, MousePointer, Palette, Grid, Trash2, Eye, EyeOff, Eraser, PaintBucket, RotateCcw, Plus, Minus, Grid2x2, Square } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { isFogStrokeTool, type MapInteractionTool } from '../types/mapTool';

/** Brief highlight when diameter changes (20ms is imperceptible; ~0.7s reads as a quick flash). */
const FOG_SIZE_FLASH_MS = 700;

const FOG_BRUSH_MIN = 20;
const FOG_BRUSH_MAX = 120;
const FOG_BRUSH_STEP = 10;

function clampFogBrush(d: number) {
  return Math.min(FOG_BRUSH_MAX, Math.max(FOG_BRUSH_MIN, d));
}

interface DrawingToolbarProps {
  currentTool: MapInteractionTool;
  onToolChange: (tool: MapInteractionTool) => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  gridColor: string;
  onGridColorChange: (color: string) => void;
  currentUserRole?: string | null;
  onDeleteAllDrawings?: () => void;
  // Darkness layer controls
  isDarknessLayerVisible?: boolean;
  onToggleDarknessLayer?: () => void;
  onResetDarkness?: () => void;
  fogBrushDiameter?: number;
  onFogBrushDiameterChange?: (diameter: number) => void;
}

const COLORS = [
  '#000000', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'
];

const GRID_COLORS = [
  { name: 'White', value: 'white' },
  { name: 'Black', value: 'black' },
  { name: 'Red', value: 'red' },
  { name: 'Green', value: 'green' },
  { name: 'Gray', value: 'rgba(0,0,0,0.1)' },
  { name: 'Hidden', value: 'transparent' }
];

export default function DrawingToolbar({
  currentTool,
  onToolChange,
  currentColor,
  onColorChange,
  gridColor,
  onGridColorChange,
  currentUserRole,
  onDeleteAllDrawings,
  isDarknessLayerVisible,
  onToggleDarknessLayer,
  onResetDarkness,
  fogBrushDiameter = 50,
  onFogBrushDiameterChange,
}: DrawingToolbarProps) {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isGridColorPickerOpen, setIsGridColorPickerOpen] = useState(false);
  const [sizeFlashActive, setSizeFlashActive] = useState(false);
  const flashClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashClearRef.current) clearTimeout(flashClearRef.current);
    };
  }, []);

  const bumpFogBrush = (delta: number) => {
    if (!onFogBrushDiameterChange) return;
    const next = clampFogBrush(fogBrushDiameter + delta);
    if (next === fogBrushDiameter) return;
    onFogBrushDiameterChange(next);
    if (flashClearRef.current) clearTimeout(flashClearRef.current);
    setSizeFlashActive(true);
    flashClearRef.current = setTimeout(() => {
      setSizeFlashActive(false);
      flashClearRef.current = null;
    }, FOG_SIZE_FLASH_MS);
  };

  const fogStrokeSelected = isFogStrokeTool(currentTool);
  const showFogSizeHud = fogStrokeSelected || sizeFlashActive;

  return (
    <div className="fixed left-2 top-12 z-10 flex items-start gap-1.5">
    <div className="flex flex-col gap-2 backdrop-blur p-2 rounded-lg shadow-md bg-stone-300/90 w-fit min-w-[2.75rem] items-center">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "w-10 h-10",
          currentTool === 'cursor' && "bg-gray-200"
        )}
        onClick={() => onToolChange('cursor')}
      >
        <MousePointer className="w-5 h-5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "w-10 h-10",
          currentTool === 'brush' && "bg-gray-200"
        )}
        onClick={() => onToolChange('brush')}
      >
        <Brush className="w-5 h-5" />
      </Button>

      <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10"
          >
            <Palette className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2">
          <div className="grid grid-cols-4 gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                className={cn(
                  "w-8 h-8 rounded-full border-2",
                  currentColor === color && "border-black"
                )}
                style={{ backgroundColor: color }}
                onClick={() => {
                  onColorChange(color);
                  setIsColorPickerOpen(false);
                }}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {currentUserRole === 'DM' && (
        <Popover open={isGridColorPickerOpen} onOpenChange={setIsGridColorPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10"
            >
              <Grid className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <div className="grid grid-cols-2 gap-2">
              {GRID_COLORS.map((color) => (
                <button
                  key={color.value}
                  className={cn(
                    "w-full h-8 rounded border-2 text-xs",
                    gridColor === color.value && "border-black"
                  )}
                  style={{ backgroundColor: color.value }}
                  onClick={() => {
                    onGridColorChange(color.value);
                    setIsGridColorPickerOpen(false);
                  }}
                >
                  {color.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Fog of war — DM only */}
      {currentUserRole === 'DM' && (
        <>
          <div className="w-full h-px bg-gray-400 my-1" />
          
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "w-10 h-10",
              isDarknessLayerVisible ? "bg-gray-700 text-white" : "text-gray-500"
            )}
            onClick={onToggleDarknessLayer}
            title={isDarknessLayerVisible ? "Hide fog of war" : "Show fog of war"}
          >
            {isDarknessLayerVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </Button>

          {isDarknessLayerVisible && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "w-10 h-10",
                  currentTool === "darknessEraser" && "bg-gray-200"
                )}
                onClick={() => onToolChange("darknessEraser")}
                title={`Reveal fog (brush, ${fogBrushDiameter}px)`}
              >
                <Eraser className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "w-10 h-10",
                  currentTool === "darknessBrush" && "bg-gray-200"
                )}
                onClick={() => onToolChange("darknessBrush")}
                title={`Paint fog (brush, ${fogBrushDiameter}px)`}
              >
                <PaintBucket className="w-5 h-5" />
              </Button>

              <div className="flex flex-col gap-0.5 items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "w-10 h-10",
                    currentTool === "darknessEraserCell" && "bg-gray-200"
                  )}
                  onClick={() => onToolChange("darknessEraserCell")}
                  title="Reveal grid squares (click or drag in a line)"
                >
                  <Grid2x2 className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "w-10 h-10",
                    currentTool === "darknessBrushCell" && "bg-gray-200"
                  )}
                  onClick={() => onToolChange("darknessBrushCell")}
                  title="Fog grid squares (click or drag in a line)"
                >
                  <Square className="w-5 h-5" />
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10"
                onClick={onResetDarkness}
                title="Reset fog of war"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            </>
          )}
        </>
      )}

      {currentUserRole === 'DM' && onDeleteAllDrawings && (
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 mt-2 text-red-600 hover:text-red-700 hover:bg-red-100"
          onClick={onDeleteAllDrawings}
          title="Delete All Drawings on Scene"
        >
          <Trash2 className="w-5 h-5" />
        </Button>
      )}
    </div>

    {currentUserRole === 'DM' && isDarknessLayerVisible && showFogSizeHud && (
      <div
        className={cn(
          "pointer-events-auto mt-1 flex flex-col items-center gap-1 rounded-lg border border-stone-500/40 bg-stone-400/95 px-2 py-1.5 shadow-md backdrop-blur-sm transition-[transform,box-shadow,background-color] duration-150",
          sizeFlashActive && "scale-105 border-amber-500/70 bg-amber-100/95 shadow-lg ring-2 ring-amber-400/50"
        )}
      >
        <span
          className={cn(
            "min-w-[2.75rem] text-center text-xs font-bold tabular-nums text-stone-900",
            sizeFlashActive && "text-stone-950"
          )}
        >
          {fogBrushDiameter}px
        </span>
        {fogStrokeSelected && onFogBrushDiameterChange && (
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 min-w-0 rounded border border-stone-500/50 bg-stone-200/90 hover:bg-stone-300"
              onClick={() => bumpFogBrush(FOG_BRUSH_STEP)}
              disabled={fogBrushDiameter >= FOG_BRUSH_MAX}
              title="Larger brush"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 min-w-0 rounded border border-stone-500/50 bg-stone-200/90 hover:bg-stone-300"
              onClick={() => bumpFogBrush(-FOG_BRUSH_STEP)}
              disabled={fogBrushDiameter <= FOG_BRUSH_MIN}
              title="Smaller brush"
            >
              <Minus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    )}
    </div>
  );
} 