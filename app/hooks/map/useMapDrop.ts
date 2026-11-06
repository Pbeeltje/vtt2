"use client"

import { useCallback, useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { clientToGridLogical } from "@/lib/utils"
import type { LayerImage } from "../../types/layerImage"
import type { DMImage } from "../../types/image"
import { createCharacterToken } from "../../lib/tokens"
import { snapDown } from "../../lib/map-items"

/** Size of a library image or uploaded file when first dropped on the map (the DM resizes it after). */
const DROPPED_IMAGE_SIZE = 100

interface UseMapDropProps {
  gridRef: React.RefObject<HTMLDivElement>
  zoomLevel: number
  gridSize: number
  isDM: boolean
  currentUserId: number
  currentSceneId: number | null
  /** Adds the item to the scene: tokens on the top layer, images on the middle layer. */
  onPlace: (item: LayerImage, layer: "top" | "middle") => void
  /** A player's own token, which the server places for them. */
  onPlayerPlaceToken: (token: LayerImage) => void
  onUploadImage: (category: string, file: File) => Promise<DMImage | null>
}

const isFileDrag = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files")

/**
 * Things dragged onto the map from outside it:
 * - a character from the character list (CharacterList): their token, snapped to the cell;
 * - an image from the DM's library (ImageList): Tokens and Props snap to the cell, Images don't;
 * - an image file from the computer (DM): uploaded to the library, then placed.
 */
export function useMapDrop({ gridRef, zoomLevel, gridSize, isDM, currentUserId, currentSceneId, onPlace, onPlayerPlaceToken, onUploadImage }: UseMapDropProps) {
  /** A file is being dragged over the map (the DM sees where it will go). */
  const [isFileOver, setIsFileOver] = useState(false)

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault()
      const file = isFileDrag(e)
      e.dataTransfer.dropEffect = file && !isDM ? "none" : "copy"
      if (file && isDM) setIsFileOver(true)
    },
    [isDM]
  )

  const onDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsFileOver(false)
  }, [])

  const placeCharacter = useCallback(
    (raw: string, at: { x: number; y: number }) => {
      let character
      try {
        character = JSON.parse(raw)
      } catch {
        return
      }
      const token = createCharacterToken(character, snapDown(at.x, gridSize), snapDown(at.y, gridSize), gridSize)
      if (isDM) return onPlace(token, "top")
      if (character?.userId !== currentUserId) {
        toast({ title: "Not your character", description: "You can only place your own tokens.", variant: "destructive" })
        return
      }
      onPlace(token, "top")
      onPlayerPlaceToken(token)
    },
    [gridSize, isDM, currentUserId, onPlace, onPlayerPlaceToken]
  )

  const placeLibraryImage = useCallback(
    (raw: string, at: { x: number; y: number }) => {
      let image: { imageId?: unknown; url?: unknown; category?: unknown }
      try {
        image = JSON.parse(raw)
      } catch {
        return
      }
      if (typeof image?.url !== "string") return
      const category = typeof image.category === "string" ? image.category : "Image"
      const id = `${image.imageId}-${Date.now()}`
      if (category === "Token") {
        onPlace({ id, url: image.url, category, x: snapDown(at.x, gridSize), y: snapDown(at.y, gridSize), width: gridSize, height: gridSize }, "top")
      } else {
        const snap = category === "Prop"
        onPlace(
          {
            id,
            url: image.url,
            category,
            x: snap ? snapDown(at.x, gridSize) : at.x,
            y: snap ? snapDown(at.y, gridSize) : at.y,
            width: DROPPED_IMAGE_SIZE,
            height: DROPPED_IMAGE_SIZE,
          },
          "middle"
        )
      }
    },
    [gridSize, onPlace]
  )

  const placeFile = useCallback(
    async (file: File, at: { x: number; y: number }) => {
      const uploaded = await onUploadImage("Image", file)
      if (!uploaded) return
      onPlace(
        { id: `${uploaded.Id}-${Date.now()}`, url: uploaded.Link, category: "Image", x: at.x, y: at.y, width: DROPPED_IMAGE_SIZE, height: DROPPED_IMAGE_SIZE },
        "middle"
      )
      toast({ title: "Image on map", description: `${uploaded.Name ?? "Image"} added to the scene and image list.` })
    },
    [onUploadImage, onPlace]
  )

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault()
      setIsFileOver(false)
      const rect = gridRef.current?.getBoundingClientRect()
      if (!currentSceneId || !rect) return
      const at = clientToGridLogical(e.clientX, e.clientY, rect, zoomLevel)

      // The character list also sets application/json, so check for a character first.
      const character = e.dataTransfer.getData("character")
      const libraryImage = e.dataTransfer.getData("application/json")
      const file = e.dataTransfer.files?.[0]
      if (e.dataTransfer.getData("characterId") && character) placeCharacter(character, at)
      else if (libraryImage) {
        if (isDM) placeLibraryImage(libraryImage, at)
      } else if (file && isDM) void placeFile(file, at)
    },
    [gridRef, currentSceneId, zoomLevel, isDM, placeCharacter, placeLibraryImage, placeFile]
  )

  return { isFileOver, onDragOver, onDragLeave, onDrop }
}
