import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Viewport → GameGrid inner coordinate space. The grid root uses `transform: scale(zoomLevel)`;
 * token `left`/`top` and the drawing SVG use this same space from the grid's top-left (0,0).
 */
export function clientToGridLogical(
  clientX: number,
  clientY: number,
  gridRect: DOMRect,
  zoomLevel: number
): { x: number; y: number } {
  const z = zoomLevel || 1
  return {
    x: (clientX - gridRect.left) / z,
    y: (clientY - gridRect.top) / z,
  }
}
