// types/inventory.ts
export interface Inventory {
  InventoryId: number;
  CharacterId: number;
}

export interface InventoryItem {
  InventoryItemId: number;
  InventoryId: number;
  SlotNumber: number;
  ItemId: number | null;
}

export interface Item {
  ItemId: number;
  Name: string;
  Description: string | null;
}