"use client"

import { useEffect, useRef } from "react"

/** True when a key press belongs to a text field or an open dialog, not to the map. */
export function isKeyForSomethingElse(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null
  if (target?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return true
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
}

interface MapKeyHandlers {
  /** Delete / Backspace on the map. Returns whether anything was selected to delete. */
  onDelete: () => boolean
  /** Arrow keys: move the selection one grid cell (dx, dy in cells). Returns whether it did. */
  onNudge: (dx: number, dy: number) => boolean
}

const NUDGE: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}

/** Map keyboard shortcuts. They ignore keys typed into chat, notes, forms and dialogs. */
export function useMapKeyboard(handlers: MapKeyHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isKeyForSomethingElse(e)) return
      const handled =
        e.key === "Delete" || e.key === "Backspace"
          ? handlersRef.current.onDelete()
          : NUDGE[e.key]
            ? handlersRef.current.onNudge(...NUDGE[e.key])
            : false
      if (handled) e.preventDefault()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
