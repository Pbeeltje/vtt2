export type MapInteractionTool =
  | "brush"
  | "cursor"
  | "darknessEraser"
  | "darknessBrush"
  | "darknessEraserCell"
  | "darknessBrushCell"

export function isFogStrokeTool(t: MapInteractionTool): boolean {
  return t === "darknessEraser" || t === "darknessBrush"
}

export function isFogCellTool(t: MapInteractionTool): boolean {
  return t === "darknessEraserCell" || t === "darknessBrushCell"
}

export function isAnyFogTool(t: MapInteractionTool): boolean {
  return isFogStrokeTool(t) || isFogCellTool(t)
}

/** Tools that use click-drag stroke on the grid (brush + fog reveal/paint strokes). */
export function isCanvasStrokeTool(t: MapInteractionTool): boolean {
  return t === "brush" || isFogStrokeTool(t)
}
