import React from 'react';

export interface DarknessPath {
  id: string;
  type: "erase" | "paint";
  createdAt: string;
  /** Stroke-based edit (omit when using cellRect). */
  path?: string;
  /** Brush diameter in scene pixels; defaults to 50 for legacy paths. */
  strokeWidth?: number;
  /** Single grid cell in scene coordinates. */
  cellRect?: { x: number; y: number; width: number; height: number };
}

interface DarknessLayerProps {
  width: number;
  height: number;
  darknessPaths: DarknessPath[];
  isVisible: boolean;
  currentUserRole?: string | null;
}

export default function DarknessLayer({
  width,
  height,
  darknessPaths,
  isVisible,
  currentUserRole,
}: DarknessLayerProps) {
  const isDM = currentUserRole === 'DM';
  
  // Don't render anything if not visible
  if (!isVisible) return null;

  /** Paint vs erase must interleave by time; if all paints render after all erases, fog paint blocks later reveals forever. */
  const orderedPaths = [...darknessPaths].sort((a, b) => {
    const t = (a.createdAt || "").localeCompare(b.createdAt || "");
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });

  const maskOperationNodes = orderedPaths.map((p) => {
    const ink = p.type === "erase" ? "black" : "white";
    if (p.cellRect) {
      return (
        <rect
          key={p.id}
          x={p.cellRect.x}
          y={p.cellRect.y}
          width={p.cellRect.width}
          height={p.cellRect.height}
          fill={ink}
        />
      );
    }
    if (!p.path) return null;
    return (
      <path
        key={p.id}
        d={p.path}
        stroke={ink}
        strokeWidth={p.strokeWidth ?? 50}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    );
  });

  // For players, show solid black overlay with erased areas creating transparent holes
  if (!isDM) {
    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ 
          zIndex: 45,
          width: '100%',
          height: '100%'
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          width={width}
          height={height}
          style={{ pointerEvents: 'none' }}
        >
          <defs>
            <mask id="darkness-mask-player">
              {/* White background = visible darkness */}
              <rect width="100%" height="100%" fill="white" />
              {/* Chronological: black = reveal, white = fog; newest wins per pixel */}
              {maskOperationNodes}
            </mask>
          </defs>
          
          {/* Base darkness layer */}
          <rect 
            width="100%" 
            height="100%" 
            fill="black" 
            mask="url(#darkness-mask-player)"
          />
        </svg>
      </div>
    );
  }

  // For DM, show semi-transparent overlay with the same logic
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ 
        zIndex: 45,
        width: '100%',
        height: '100%'
      }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        width={width}
        height={height}
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id="darkness-mask-dm">
            {/* White background = visible darkness */}
            <rect width="100%" height="100%" fill="white" />
            {maskOperationNodes}
          </mask>
        </defs>
        
        {/* Base darkness layer (semi-transparent for DM) */}
        <rect 
          width="100%" 
          height="100%" 
          fill="rgba(0,0,0,0.5)" 
          mask="url(#darkness-mask-dm)"
        />
      </svg>
    </div>
  );
} 