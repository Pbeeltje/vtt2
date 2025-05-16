// types/inventory.ts
export interface InventoryItem {
    slot: number;
    itemId: number | null;
    name: string;
    description: string | null;
  }
  
  export interface Inventory {
    Inventoryid: number;
    CharacterId: number;
    Contents: InventoryItem[];
  }