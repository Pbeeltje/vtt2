// hooks/useInventory.ts
import { useState, useEffect } from 'react';
import { toast } from "@/components/ui/use-toast";

interface InventoryItem {
  slot: number;
  name: string;
  description?: string | null;
}

interface Inventory {
  Inventoryid: number;
  Contents: InventoryItem[];
  CharacterId: number;
}

export function useInventory(characterId: number) {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [inventoryForm, setInventoryForm] = useState<{ name: string; description: string | null; slot: number }>({
    name: '',
    description: null,
    slot: 0,
  });

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const response = await fetch(`/inventory?characterId=${characterId}`);
        if (!response.ok) throw new Error(`Failed to fetch inventory: ${response.statusText}`);
        const data: Inventory = await response.json();
        setInventory(data);
        console.log("Fetched inventory:", data.Contents);
      } catch (error: any) {
        console.error("Error fetching inventory:", error);
        toast({ title: "Error", description: "Failed to fetch inventory.", variant: "destructive" });
        setInventory({
          Inventoryid: -1,
          CharacterId: characterId,
          Contents: Array.from({ length: 16 }, (_, i) => ({
            slot: i + 1,
            name: '',
            description: null,
          })),
        });
      }
    };
    fetchInventory();
  }, [characterId]);

  const handleInventoryEdit = (slot: number) => {
    setEditingSlot(slot);
    const item = inventory?.Contents.find(item => item.slot === slot) || { slot, name: '', description: null };
    setInventoryForm({ name: item.name, description: item.description ?? null, slot: item.slot });
  };

  const handleInventoryFormChange = (field: keyof typeof inventoryForm, value: string | number) => {
    if (inventoryForm) {
      setInventoryForm({
        ...inventoryForm,
        [field]: field === 'slot' ? parseInt(value as string) || 0 : value,
      });
    }
  };

  const handleInventorySubmit = async (slot: number) => {
    if (!inventory || !inventoryForm) return;
    try {
      const updatedContents = inventory.Contents.map(item =>
        item.slot === slot
          ? { slot, name: inventoryForm.name, description: inventoryForm.description }
          : item
      );
      const response = await fetch(`/inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId: inventory.Inventoryid, contents: updatedContents }),
      });
      if (!response.ok) throw new Error(`Failed to update inventory: ${response.statusText}`);
      const updatedInventory: Inventory = await response.json();
      setInventory(updatedInventory);
      setEditingSlot(null);
      setInventoryForm({ name: '', description: null, slot: 0 });
      toast({ title: "Inventory Updated", description: `Slot ${slot} saved successfully.` });
    } catch (error: any) {
      console.error("Error updating inventory:", error);
      toast({ title: "Error", description: "Failed to update inventory.", variant: "destructive" });
    }
  };

  const handleClearSlot = async (slot: number) => {
    if (!inventory) return;
    try {
      const updatedContents = inventory.Contents.map(item =>
        item.slot === slot ? { slot, name: '', description: null } : item
      );
      const response = await fetch(`/inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId: inventory.Inventoryid, contents: updatedContents }),
      });
      if (!response.ok) throw new Error(`Failed to clear slot: ${response.statusText}`);
      const updatedInventory: Inventory = await response.json();
      setInventory(updatedInventory);
      toast({ title: "Slot Cleared", description: `Slot ${slot} cleared.` });
    } catch (error: any) {
      console.error("Error clearing slot:", error);
      toast({ title: "Error", description: "Failed to clear slot.", variant: "destructive" });
    }
  };

  return { inventory, editingSlot, inventoryForm, handleInventoryEdit, handleInventoryFormChange, handleInventorySubmit, handleClearSlot };
}