"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { LayerImage } from "../../types/layerImage"

interface UseItemRotateProps {
  enabled: boolean
  /** Applies a rotation (degrees, clockwise, 0–359) to the item with this id. */
  rotateItem: (id: string, rotation: number) => void
}

const SNAP_DEGREES = 15

/**
 * Drag a map image's rotation handle to turn it around its centre (DM only).
 * Hold Shift to snap to 15° steps.
 */
export function useItemRotate({ enabled, rotateItem }: UseItemRotateProps) {
  const [rotatingId, setRotatingId] = useState<string | null>(null)
  const center = useRef<{ x: number; y: number } | null>(null)

  const startRotate = useCallback(
    (e: React.MouseEvent<HTMLElement>, item: LayerImage) => {
      if (!enabled) return
      e.preventDefault()
      e.stopPropagation()
      // The rotated box spins around its centre, so its screen bounding box shares that centre
      // whatever the current angle and zoom.
      const box = (e.currentTarget.closest("[data-rotate-box]") as HTMLElement | null)?.getBoundingClientRect()
      if (!box) return
      center.current = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
      setRotatingId(item.id)
    },
    [enabled]
  )

  useEffect(() => {
    if (!rotatingId) return
    const onMove = (e: MouseEvent) => {
      const c = center.current
      if (!c) return
      // The handle sits above the item, so pointing straight up means 0°.
      let degrees = (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI + 90
      if (e.shiftKey) degrees = Math.round(degrees / SNAP_DEGREES) * SNAP_DEGREES
      rotateItem(rotatingId, ((Math.round(degrees) % 360) + 360) % 360)
    }
    const onUp = () => {
      center.current = null
      setRotatingId(null)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [rotatingId, rotateItem])

  return { rotatingId, startRotate }
}
