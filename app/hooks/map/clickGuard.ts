// After a drag on the map (moving, resizing, rotating, a selection box) the browser still fires a
// click where the mouse was released. That click isn't a click on the map: it would reset the
// selection. Drag handlers call `swallowNextClick` when they end; click handlers ask `isSwallowedClick`.

let swallowed = false

/** Ignore the click that follows the current mouse release (it is dispatched before any timer runs). */
export function swallowNextClick() {
  swallowed = true
  setTimeout(() => (swallowed = false), 0)
}

export function isSwallowedClick(): boolean {
  return swallowed
}
