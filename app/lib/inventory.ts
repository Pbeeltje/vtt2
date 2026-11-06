import { INVENTORY_SLOTS, type InventorySlot } from "../types/inventory"

export type CarryGroup = "light" | "moderate" | "encumbered" | "dropped"

export interface InventoryGroup {
  kind: CarryGroup
  /** Slot numbers in this group, in order. */
  slots: number[]
}

/** Slots you can always carry in hands, pockets and belt, whatever your strength. */
export const LIGHT_SLOTS = 4

/**
 * How a character's inventory slots split into carrying groups. After 4 light slots come
 * half max-strength moderate slots and as many encumbered ones. Slots past those hold items
 * the character can no longer carry: the "dropped" group lists them, up to the last one that
 * still holds an item, and is left out when there are none. Groups never exceed the slots
 * the server keeps.
 */
export function inventoryGroups(maxStrength: number, slots: readonly InventorySlot[]): InventoryGroup[] {
  const half = Math.round(Math.max(0, maxStrength || 0) / 2)
  const sizes: [CarryGroup, number][] = [
    ["light", LIGHT_SLOTS],
    ["moderate", half],
    ["encumbered", half],
  ]
  const groups: InventoryGroup[] = []
  let next = 1
  for (const [kind, size] of sizes) {
    const last = Math.min(next + size - 1, INVENTORY_SLOTS)
    if (last >= next) groups.push({ kind, slots: range(next, last) })
    next = last + 1
  }
  const lastFilled = Math.max(0, ...slots.filter((s) => s.item).map((s) => s.SlotNumber))
  if (lastFilled >= next) groups.push({ kind: "dropped", slots: range(next, Math.min(lastFilled, INVENTORY_SLOTS)) })
  return groups
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
