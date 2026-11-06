"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { LayerImage } from "../../types/layerImage"
import { startGesture, type Gesture } from "./gesture"

interface UseItemRotateProps {
  enabled: boolean
  /** Applies a rotation (degrees, clockwise, 0–359) to the item with this id. */
  rotateItem: (id: string, rotation: number) => void
}

const SNAP_DEGREES = 15

/**
 * Drag a map image's rotation handle to turn it around its centre (DM only).
 * Hold Shift to snap to 15° steps. Runs as a map gesture (./gesture); Escape puts the item back
 * at its original angle.
 */
export function useItemRotate({ enabled, rotateItem }: UseItemRotateProps) {
  const [rotatingId, setRotatingId] = useState<string | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const rotateRef = useRef(rotateItem)
  rotateRef.current = rotateItem

  const startRotate = useCallback(
    (e: React.MouseEvent<HTMLElement>, item: LayerImage) => {
      if (!enabled) return
      e.preventDefault()
      e.stopPropagation()
      // The rotated box spins around its centre, so its screen bounding box shares that centre
      // whatever the current angle and zoom.
      const box = (e.currentTarget.closest("[data-rotate-box]") as HTMLElement | null)?.getBoundingClientRect()
      if (!box) return
      const center = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
      const id = item.id
      const original = item.rotation ?? 0
      let turned = false

      const gesture = startGesture(e, {
        kind: "rotate",
        button: e.button,
        onMove: (ev) => {
          // The handle sits above the item, so pointing straight up means 0°.
          let degrees = (Math.atan2(ev.clientY - center.y, ev.clientX - center.x) * 180) / Math.PI + 90
          if (ev.shiftKey) degrees = Math.round(degrees / SNAP_DEGREES) * SNAP_DEGREES
          turned = true
          rotateRef.current(id, ((Math.round(degrees) % 360) + 360) % 360)
        },
        onEnd: (commit) => {
          gestureRef.current = null
          setRotatingId(null)
          if (turned && !commit) rotateRef.current(id, original)
          return turned
        },
      })
      if (!gesture) return
      gestureRef.current = gesture
      setRotatingId(id)
    },
    [enabled]
  )

  useEffect(() => () => gestureRef.current?.cancel(), [])

  return { rotatingId, startRotate }
}
