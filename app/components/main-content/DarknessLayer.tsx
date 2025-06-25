import React from 'react';

export interface DarknessPath {
  id: string;
  path: string;
  type: 'erase' | 'paint';
  createdAt: string;
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

  const erasePaths = darknessPaths.filter(p => p.type === 'erase');
  const paintPaths = darknessPaths.filter(p => p.type === 'paint');

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
              {/* Black strokes = transparent holes (erased areas) */}
              {erasePaths.map(path => (
                <path
                  key={path.id}
                  d={path.path}
                  stroke="black"
                  strokeWidth="50"
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {/* White strokes = restored darkness (paint paths restore erased areas) */}
              {paintPaths.map(path => (
                <path
                  key={path.id}
                  d={path.path}
                  stroke="white"
                  strokeWidth="50"
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
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
            {/* Black strokes = transparent holes (erased areas) */}
            {erasePaths.map(path => (
              <path
                key={path.id}
                d={path.path}
                stroke="black"
                strokeWidth="50"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {/* White strokes = restored darkness (paint paths restore erased areas) */}
            {paintPaths.map(path => (
              <path
                key={path.id}
                d={path.path}
                stroke="white"
                strokeWidth="50"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
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