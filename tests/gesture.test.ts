import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { activeGesture, isSwallowedClick, startGesture } from "../app/hooks/map/gesture"

// The controller only uses window when called; Node's EventTarget stands in for the browser window.
// Node's EventTarget doesn't match the boolean capture flag on removal as browsers do, and with a
// single target capture makes no difference, so the stub drops it.
const target = new EventTarget()
const win = {
  addEventListener: (type: string, listener: EventListener) => target.addEventListener(type, listener),
  removeEventListener: (type: string, listener: EventListener) => target.removeEventListener(type, listener),
  dispatchEvent: (event: Event) => target.dispatchEvent(event),
}
beforeAll(() => {
  vi.stubGlobal("window", win)
})

/** A pointer/keyboard event with the fields the controller reads. */
function fire(type: string, fields: Record<string, unknown> = {}) {
  const event = Object.assign(new Event(type, { cancelable: true }), fields)
  win.dispatchEvent(event)
  return event
}

const LEFT = { button: 0, buttons: 1 }
const MIDDLE = { button: 1, buttons: 4 }

function gesture(kind: "drag" | "pan" | "stroke" | "select", press: { button: number; buttons: number }, changed = true) {
  const moves: number[] = []
  const ends: boolean[] = []
  // As in the browser: the press reaches window listeners before React's mousedown handler starts the gesture.
  fire("pointerdown", press)
  const g = startGesture(press, {
    kind,
    button: press.button,
    onMove: (ev) => moves.push(ev.clientX),
    onEnd: (commit) => {
      ends.push(commit)
      return changed
    },
  })
  return { g, moves, ends }
}

// A swallowed click is forgotten on the next tick.
beforeEach(() => new Promise((r) => setTimeout(r, 0)))

afterEach(() => {
  // Leave nothing running for the next test.
  fire("pointercancel")
})

describe("map gestures", () => {
  it("runs until its button is released, then commits", () => {
    const { g, moves, ends } = gesture("drag", LEFT)
    expect(g).not.toBeNull()
    expect(activeGesture()).toBe("drag")
    fire("pointermove", { clientX: 5, buttons: 1 })
    fire("pointermove", { clientX: 9, buttons: 1 })
    fire("pointerup", { button: 0, buttons: 0 })
    expect(moves).toEqual([5, 9])
    expect(ends).toEqual([true])
    expect(activeGesture()).toBeNull()
    // No more events reach it once it has ended.
    fire("pointermove", { clientX: 20, buttons: 0 })
    expect(moves).toEqual([5, 9])
  })

  it("only lets one gesture run at a time", () => {
    const stroke = gesture("stroke", LEFT)
    // Middle-click while the left button is still held: no pan starts, the stroke goes on.
    const pan = gesture("pan", { button: 1, buttons: 1 | 4 })
    expect(pan.g).toBeNull()
    expect(activeGesture()).toBe("stroke")
    fire("pointerup", { button: 0, buttons: 0 })
    expect(stroke.ends).toEqual([true])
  })

  it("cancels on Escape without letting the key through", () => {
    const { ends } = gesture("drag", LEFT)
    const key = fire("keydown", { key: "Escape" })
    expect(ends).toEqual([false])
    expect(key.defaultPrevented).toBe(true)
    expect(activeGesture()).toBeNull()
  })

  it("ends when its button is released while another is still held", () => {
    const { ends } = gesture("pan", MIDDLE)
    // Chorded buttons: releasing the middle one arrives as a pointermove.
    fire("pointermove", { clientX: 3, buttons: 1 })
    expect(ends).toEqual([true])
  })

  it("ignores the release of a different button", () => {
    const { ends } = gesture("drag", LEFT)
    fire("pointerup", { button: 2, buttons: 1 })
    expect(ends).toEqual([])
  })

  it("cancels a gesture left hanging when a new press shows its button is up", () => {
    const stale = gesture("drag", LEFT)
    const next = gesture("stroke", LEFT) // buttons: 1 only for the new press, but release was missed
    expect(next.g).toBeNull() // left is still reported held, so the old one still owns it
    const pan = gesture("pan", MIDDLE) // left not held any more: the old drag was left hanging
    expect(stale.ends).toEqual([false])
    expect(pan.g).not.toBeNull()
    expect(activeGesture()).toBe("pan")
  })

  it("commits on window blur, and swallows the click after a release that changed something", () => {
    const blurred = gesture("drag", LEFT)
    fire("blur")
    expect(blurred.ends).toEqual([true])
    expect(isSwallowedClick()).toBe(false) // no release, so no click follows

    gesture("drag", LEFT, true)
    fire("pointerup", { button: 0, buttons: 0 })
    expect(isSwallowedClick()).toBe(true)
  })

  it("after Escape, ignores the click that releasing the button fires", () => {
    const { ends } = gesture("select", LEFT, false)
    fire("keydown", { key: "Escape" })
    expect(ends).toEqual([false])
    expect(isSwallowedClick()).toBe(false)
    fire("pointerup", { button: 0, buttons: 0 })
    expect(isSwallowedClick()).toBe(true)
  })

  it("does not swallow the click after a plain click", () => {
    gesture("drag", LEFT, false)
    fire("pointerup", { button: 0, buttons: 0 })
    expect(isSwallowedClick()).toBe(false)
  })
})
