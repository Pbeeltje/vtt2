import { useState } from 'react';
import { cn } from "@/lib/utils";
import { Brush, MousePointer, Palette, Grid } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface DrawingToolbarProps {
  currentTool: 'brush' | 'cursor';
  onToolChange: (tool: 'brush' | 'cursor') => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  gridColor: string;
  onGridColorChange: (color: string) => void;
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
}: DrawingToolbarProps) {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isGridColorPickerOpen, setIsGridColorPickerOpen] = useState(false);

  return (
    <div className="absolute left-2 top-12 flex flex-col gap-2 bg-white/90 backdrop-blur p-2 rounded-lg shadow-md">
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
    </div>
  );
} 