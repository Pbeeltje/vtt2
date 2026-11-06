// What /api/characters/[id]/inventory returns: a character's fixed set of numbered slots.

/** Slots per character; slot numbers run 1..INVENTORY_SLOTS. */
export const INVENTORY_SLOTS = 16

export interface Item {
  ItemId: number
  Name: string
  Description: string | null
}

export interface InventorySlot {
  SlotNumber: number
  ItemId: number | null
  item: Item | null
}

export interface CharacterInventory {
  CharacterId: number
  Slots: InventorySlot[]
}
