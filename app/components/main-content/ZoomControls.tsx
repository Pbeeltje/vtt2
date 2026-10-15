interface ZoomControlsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

/** Zoom out / level / in, above the drawing toolbar. Clicking the level resets it to 100%. */
export default function ZoomControls({ zoomLevel, onZoomIn, onZoomOut, onZoomReset }: ZoomControlsProps) {
  return (
    <div
      className="jade jade-marble mb-2 flex w-fit items-center gap-1 p-1.5"
      style={{ boxShadow: "0 0 0 2px #0a0d0a, inset 0 0 0 1px #8e9a80, 0 8px 18px rgba(0,0,0,.7)" }}
    >
      <button type="button" onClick={onZoomOut} className="jade-slot h-7 w-7 text-lg font-semibold leading-none" title="Zoom out" aria-label="Zoom out">
        −
      </button>
      <button
        type="button"
        onClick={onZoomReset}
        className="jade-inset h-7 w-14 text-center text-xs font-semibold tabular-nums text-[var(--jade-ink-hi)] hover:text-[#fff3b0]"
        title="Reset zoom to 100%"
      >
        {Math.round(zoomLevel * 100)}%
      </button>
      <button type="button" onClick={onZoomIn} className="jade-slot h-7 w-7 text-lg font-semibold leading-none" title="Zoom in" aria-label="Zoom in">
        +
      </button>
    </div>
  )
}
