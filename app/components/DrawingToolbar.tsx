import { useState, useRef, useEffect } from 'react';
import { PLAYER_COLORS, PLAYER_COLOR_NAMES } from "@/lib/player-colors";
import { cn } from "@/lib/utils";
import { Brush, MousePointer, Palette, Grid, Trash2, Eye, EyeOff, Eraser, PaintBucket, RotateCcw, Plus, Minus, Grid2x2, Square } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

/** Black plus the player colours, so your own colour (the default pen) is always in the list. */
const COLORS: string[] = ['#000000', ...PLAYER_COLORS];
const colorName = (color: string) => PLAYER_COLOR_NAMES[color] ?? 'Black';

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

  const isDM = currentUserRole === 'DM';
  const slot = "jade-slot h-10 w-10";
  const icon = "h-6 w-6";

  return (
    <div className="jade flex items-start gap-2">
      <div
        className="jade-marble flex w-fit flex-col items-center gap-1 p-1.5"
        style={{ boxShadow: "0 0 0 2px #0a0d0a, inset 0 0 0 1px #8e9a80, 0 8px 18px rgba(0,0,0,.7)" }}
      >
        <button
          type="button"
          className={slot}
          data-active={currentTool === 'cursor'}
          onClick={() => onToolChange('cursor')}
          title="Select and move tokens and props (click empty map to box-select)"
        >
          <MousePointer className={icon} strokeWidth={1.9} />
        </button>

        <button type="button" className={slot} data-active={currentTool === 'brush'} onClick={() => onToolChange('brush')} title="Draw on the map (freehand)">
          <Brush className={icon} strokeWidth={1.9} />
        </button>

        <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
          <PopoverTrigger asChild>
            <button type="button" className={slot} title="Drawing pen colour">
              <Palette className={icon} strokeWidth={1.9} />
              <i
                className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full shadow-[0_0_0_1px_#000,0_0_0_2px_#8e9a80]"
                style={{ backgroundColor: currentColor }}
                aria-hidden
              />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="jade jade-well w-auto rounded-none border-0 p-2.5">
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={`Draw in ${colorName(color).toLowerCase()}`}
                  className={cn(
                    "h-6 w-6 rounded-full",
                    currentColor.toLowerCase() === color.toLowerCase()
                      ? "shadow-[0_0_0_1px_#000,0_0_0_3px_#e0c25a]"
                      : "shadow-[0_0_0_1px_#000,0_0_0_2px_#5f6b56]"
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

        {isDM && (
          <Popover open={isGridColorPickerOpen} onOpenChange={setIsGridColorPickerOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={slot} title="Grid line colour on the map">
                <Grid className={icon} strokeWidth={1.9} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="jade jade-well w-auto rounded-none border-0 p-2.5">
              <div className="grid grid-cols-2 gap-1.5">
                {GRID_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    title={`Grid: ${color.name}`}
                    className={cn(
                      "h-6 w-16 text-[11px] font-semibold",
                      gridColor === color.value ? "shadow-[0_0_0_1px_#000,0_0_0_3px_#e0c25a]" : "shadow-[0_0_0_1px_#000,inset_0_0_0_1px_#5f6b56]"
                    )}
                    style={{
                      // Gray is translucent black, so preview it over a light base (as it
                      // looks on a map) instead of letting the dark popover show through.
                      background: color.value === "transparent"
                        ? "#141a14"
                        : color.value === "rgba(0,0,0,0.1)"
                          ? `linear-gradient(${color.value}, ${color.value}), #ffffff`
                          : color.value,
                      color: color.value === "white" || color.value === "rgba(0,0,0,0.1)" ? "#1d1606" : "#f2ecd2",
                    }}
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

        {/* Fog of war (DM only). The column grows its fog tools while fog is shown. */}
        {isDM && (
          <>
            <hr className="mx-0.5 my-0.5 h-0.5 w-9 border-0 bg-[linear-gradient(#0a0d0a_50%,#6f7b62_50%)]" />
            <button
              type="button"
              className={slot}
              data-lit={Boolean(isDarknessLayerVisible)}
              onClick={onToggleDarknessLayer}
              title={isDarknessLayerVisible ? "Hide fog of war" : "Show fog of war"}
            >
              {isDarknessLayerVisible ? <EyeOff className={icon} strokeWidth={1.9} /> : <Eye className={icon} strokeWidth={1.9} />}
            </button>

            {isDarknessLayerVisible && (
              <>
                <button
                  type="button"
                  className={slot}
                  data-active={currentTool === "darknessEraser"}
                  onClick={() => onToolChange("darknessEraser")}
                  title={`Reveal fog (brush, ${fogBrushDiameter}px)`}
                >
                  <Eraser className={icon} strokeWidth={1.9} />
                </button>
                <button
                  type="button"
                  className={slot}
                  data-active={currentTool === "darknessBrush"}
                  onClick={() => onToolChange("darknessBrush")}
                  title={`Paint fog (brush, ${fogBrushDiameter}px)`}
                >
                  <PaintBucket className={icon} strokeWidth={1.9} />
                </button>
                <button
                  type="button"
                  className={slot}
                  data-active={currentTool === "darknessEraserCell"}
                  onClick={() => onToolChange("darknessEraserCell")}
                  title="Reveal grid squares (click or drag in a line)"
                >
                  <Grid2x2 className={icon} strokeWidth={1.9} />
                </button>
                <button
                  type="button"
                  className={slot}
                  data-active={currentTool === "darknessBrushCell"}
                  onClick={() => onToolChange("darknessBrushCell")}
                  title="Fog grid squares (click or drag in a line)"
                >
                  <Square className={icon} strokeWidth={1.9} fill="currentColor" fillOpacity={0.35} />
                </button>
                <button type="button" className={slot} onClick={onResetDarkness} title="Reset fog of war">
                  <RotateCcw className={icon} strokeWidth={1.9} />
                </button>
              </>
            )}
          </>
        )}

        {isDM && onDeleteAllDrawings && (
          <button type="button" className={cn(slot, "mt-1 !text-[#ff8a6a]")} onClick={onDeleteAllDrawings} title="Delete all drawings on this scene">
            <Trash2 className={icon} strokeWidth={1.9} />
          </button>
        )}
      </div>

      {isDM && isDarknessLayerVisible && showFogSizeHud && (
        <div
          className={cn(
            "jade-well pointer-events-auto mt-[226px] flex flex-col items-center gap-1.5 px-2 py-1.5 transition-transform duration-150",
            sizeFlashActive && "scale-110 shadow-[0_0_0_2px_#0a0d0a,0_0_0_4px_#e0c25a,0_0_0_5px_#0a0d0a,0_0_16px_rgba(224,194,90,.5)]"
          )}
          aria-live="polite"
        >
          <small className="jade-sc text-[10px] font-semibold leading-none text-[var(--jade-muted)]">BRUSH</small>
          <span className="min-w-[2.75rem] text-center text-sm font-bold tabular-nums text-[var(--jade-ink-hi)]">{fogBrushDiameter}px</span>
          {fogStrokeSelected && onFogBrushDiameterChange && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="jade-btn !h-6 !w-6 !p-0"
                onClick={() => bumpFogBrush(FOG_BRUSH_STEP)}
                disabled={fogBrushDiameter >= FOG_BRUSH_MAX}
                title="Larger brush"
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                type="button"
                className="jade-btn !h-6 !w-6 !p-0"
                onClick={() => bumpFogBrush(-FOG_BRUSH_STEP)}
                disabled={fogBrushDiameter <= FOG_BRUSH_MIN}
                title="Smaller brush"
              >
                <Minus className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
