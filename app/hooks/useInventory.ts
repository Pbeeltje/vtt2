"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { api, errorMessage } from "../lib/api"
import type { CharacterInventory, InventorySlot } from "../types/inventory"

/**
 * A character's inventory slots, loaded when the character changes. Saving or clearing a slot
 * patches just that slot with what the server returns.
 */
export function useInventory(characterId: number) {
  const [slots, setSlots] = useState<InventorySlot[] | null>(null)
  // A save that finishes after switching characters must not land in the new one's slots.
  const currentId = useRef(characterId)
  currentId.current = characterId

  useEffect(() => {
    setSlots(null)
    if (!characterId) return
    let cancelled = false
    api<CharacterInventory>(`/api/characters/${characterId}/inventory`)
      .then((inventory) => !cancelled && setSlots(inventory.Slots))
      .catch((error) => {
        if (cancelled) return
        setSlots([])
        toast({ title: "Couldn't load inventory", description: errorMessage(error), variant: "destructive" })
      })
    return () => {
      cancelled = true
    }
  }, [characterId])

  const putSlot = useCallback((forCharacter: number, slot: InventorySlot) => {
    if (currentId.current !== forCharacter) return
    setSlots((prev) => prev && prev.map((s) => (s.SlotNumber === slot.SlotNumber ? slot : s)))
  }, [])

  /** Empties the slot (deleting its item). Resolves false if that failed. */
  const clearSlot = useCallback(
    async (slotNumber: number): Promise<boolean> => {
      try {
        putSlot(characterId, await api<InventorySlot>(`/api/characters/${characterId}/inventory/${slotNumber}`, { method: "DELETE" }))
        toast({ title: "Slot cleared", description: `Slot ${slotNumber} cleared.` })
        return true
      } catch (error) {
        toast({ title: "Couldn't clear the slot", description: errorMessage(error), variant: "destructive" })
        return false
      }
    },
    [characterId, putSlot]
  )

  /** Puts an item with this name and note in the slot; both blank empties it. Resolves false if that failed. */
  const saveSlot = useCallback(
    async (slotNumber: number, name: string, note: string): Promise<boolean> => {
      name = name.trim()
      note = note.trim()
      if (!name && !note) return clearSlot(slotNumber)
      if (!name) {
        toast({ title: "Give the item a name", description: "An item needs a name; the note alone isn't enough.", variant: "destructive" })
        return false
      }
      try {
        putSlot(
          characterId,
          await api<InventorySlot>(`/api/characters/${characterId}/inventory/${slotNumber}`, {
            method: "PUT",
            body: { Name: name, Description: note },
          })
        )
        toast({ title: "Item saved", description: `Slot ${slotNumber} saved.` })
        return true
      } catch (error) {
        toast({ title: "Couldn't save the item", description: errorMessage(error), variant: "destructive" })
        return false
      }
    },
    [characterId, clearSlot, putSlot]
  )

  return { slots, saveSlot, clearSlot }
}
