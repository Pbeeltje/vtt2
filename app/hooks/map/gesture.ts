// The one mouse gesture running on the map at a time: moving items, a selection box, panning,
// resizing, rotating, or a drawing/fog stroke.
//
//   idle ──press──▶ active(kind) ──release of its button / window blur──▶ idle (committed)
//                         └──────────Escape / pointercancel / cancel()─────▶ idle (cancelled)
//
// While a gesture runs, window pointer events drive it (so it keeps going outside the map) and no
// other gesture can start: a middle-click pan can't begin halfway through a stroke, for example.
// Each hook supplies what its gesture does on move and on end; this module owns the lifecycle.

export type GestureKind = "drag" | "select" | "pan" | "resize" | "rotate" | "stroke"

export interface GestureHandlers {
  kind: GestureKind
  /** The mouse button that started it (MouseEvent.button); releasing that button ends it. */
  button: number
  onMove?: (ev: PointerEvent) => void
  /**
   * The gesture is over. `commit` is false when it was cancelled; `ev` is the release, if any.
   * Return true when it changed something, so the click that follows the release is ignored.
   */
  onEnd: (commit: boolean, ev?: PointerEvent) => boolean | void
}

export interface Gesture {
  kind: GestureKind
  /** Ends it without committing (a no-op once it has ended). */
  cancel: () => void
}

/** MouseEvent.button → its bit in MouseEvent.buttons. */
const BUTTON_BIT: Record<number, number> = { 0: 1, 1: 4, 2: 2, 3: 8, 4: 16 }

let active: { kind: GestureKind; button: number; end: (commit: boolean, ev?: PointerEvent) => void } | null = null
let swallowed = false

/**
 * Starts a gesture from a mousedown. Returns null (and starts nothing) while another gesture is
 * still running. One left hanging, because its button was released outside the window, is
 * cancelled first.
 */
export function startGesture(e: { buttons: number }, handlers: GestureHandlers): Gesture | null {
  if (active) {
    const stillHeld = (e.buttons & (BUTTON_BIT[active.button] ?? 0)) !== 0
    if (stillHeld) return null
    active.end(false)
  }

  let ended = false
  const end = (commit: boolean, ev?: PointerEvent) => {
    if (ended) return
    ended = true
    if (active?.end === end) active = null
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onCancel)
    window.removeEventListener("keydown", onKey, true)
    window.removeEventListener("blur", onBlur)
    if (handlers.onEnd(commit, ev) && ev) swallowNextClick()
  }
  // With several buttons down, releasing one is reported as a pointermove, not a pointerup: the
  // gesture ends whenever its own button is no longer held.
  const bit = BUTTON_BIT[handlers.button] ?? 0
  const released = (ev: PointerEvent) => (ev.buttons & bit) === 0
  const onMove = (ev: PointerEvent) => {
    if (released(ev)) end(true, ev)
    else handlers.onMove?.(ev)
  }
  const onUp = (ev: PointerEvent) => {
    if (ev.button === handlers.button || released(ev)) end(true, ev)
  }
  const onCancel = () => end(false)
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") return
    // Escape belongs to the gesture, not to a dialog or the map's keyboard shortcuts.
    ev.preventDefault()
    ev.stopPropagation()
    end(false)
    // The button is still down: the click its release fires would act on the map (deselect,
    // select). After Escape there is nothing to click.
    // A new press first means that release was missed (outside the window): forget it.
    const forget = () => {
      window.removeEventListener("pointerup", afterRelease, true)
      window.removeEventListener("pointerdown", forget, true)
    }
    const afterRelease = (up: PointerEvent) => {
      forget()
      if (up.button === handlers.button) swallowNextClick()
    }
    window.addEventListener("pointerup", afterRelease, true)
    window.addEventListener("pointerdown", forget, true)
  }
  // Losing the window mid-gesture keeps what was done so far.
  const onBlur = () => end(true)

  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onCancel)
  window.addEventListener("keydown", onKey, true)
  window.addEventListener("blur", onBlur)
  active = { kind: handlers.kind, button: handlers.button, end }
  return { kind: handlers.kind, cancel: () => end(false) }
}

/** The gesture running now, if any. */
export function activeGesture(): GestureKind | null {
  return active?.kind ?? null
}

// After a gesture the browser still fires a click where the mouse was released. That click isn't
// a click on the map: it would reset the selection. It is dispatched before any timer runs.
function swallowNextClick() {
  swallowed = true
  setTimeout(() => (swallowed = false), 0)
}

/** True for the click that follows the release of a gesture that changed something. */
export function isSwallowedClick(): boolean {
  return swallowed
}
