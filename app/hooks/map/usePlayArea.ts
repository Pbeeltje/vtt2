"use client"

import { useEffect, useMemo, useState } from "react"
import { playArea, type PlayArea } from "../../lib/map-items"

/**
 * The play area of the scene: the map image at the scene's scale, plus its border. Null until the
 * image has loaded (or when there is none).
 */
export function usePlayArea(backgroundImage: string | null, sceneScale: number, borderFraction: number): PlayArea | null {
  const [natural, setNatural] = useState<{ url: string; width: number; height: number } | null>(null)

  useEffect(() => {
    if (!backgroundImage) return
    let current = true
    const img = new window.Image()
    img.onload = () => {
      if (current) setNatural({ url: backgroundImage, width: img.naturalWidth, height: img.naturalHeight })
    }
    img.src = backgroundImage
    // A newer scene's image may load first; this one's size must not win.
    return () => {
      current = false
    }
  }, [backgroundImage])

  return useMemo(() => {
    if (!natural || natural.url !== backgroundImage) return null
    return playArea(Math.round(natural.width * sceneScale), Math.round(natural.height * sceneScale), borderFraction)
  }, [natural, backgroundImage, sceneScale, borderFraction])
}
