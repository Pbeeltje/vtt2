interface ZoomControlsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export default function ZoomControls({ 
  zoomLevel, 
  onZoomIn, 
  onZoomOut, 
  onZoomReset 
}: ZoomControlsProps) {
  return (
    <div className="flex items-center space-x-2">
      <button 
        onClick={onZoomOut} 
        className="w-6 h-6 flex items-center justify-center bg-stone-300 hover:bg-stone-500 rounded-full" 
        title="Zoom Out"
      >
        <span className="text-sm">−</span>
      </button>
      <div className="text-xs font-medium w-12 text-center bg-stone-300 rounded">
        {Math.round(zoomLevel * 100)}%
      </div>
      <button 
        onClick={onZoomIn} 
        className="w-6 h-6 flex items-center justify-center bg-stone-300 hover:bg-stone-500 rounded-full" 
        title="Zoom In"
      >
        <span className="text-sm">+</span>
      </button>
      <button 
        onClick={onZoomReset} 
        className="ml-1 px-2 py-1 text-xs bg-stone-300 hover:bg-stone-500 rounded" 
        title="Reset Zoom"
      >
        Reset
      </button>
    </div>
  )
} 