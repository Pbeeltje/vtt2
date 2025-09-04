// app/hooks/useInventory.ts
import { useState, useEffect } from 'react';
import { toast } from "@/components/ui/use-toast";
import { Item } from '../types/inventory';

export function useInventory(characterId: number) {
  const [inventory, setInventory] = useState<any>(null); // Inventory with Slots
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [inventoryForm, setInventoryForm] = useState<{ itemId: number | null; slot: number }>({
    itemId: null,
    slot: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInventory = async () => {
      if (!characterId) {
        setInventory(null);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const url = `/api/characters/${characterId}/inventory`;
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          throw new Error(`Failed to fetch inventory: ${response.status}`);
        }
        const data = await response.json();
        setInventory(data);
      } catch (err) {
        console.error('Error fetching inventory:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch inventory');
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, [characterId]);

  const handleInventoryEdit = (slot: number) => {
    setEditingSlot(slot);
    const slotObj = inventory?.Slots.find((s: any) => s.SlotNumber === slot) || { ItemId: null, SlotNumber: slot };
    setInventoryForm({ itemId: slotObj.ItemId, slot: slotObj.SlotNumber });
  };

  const handleInventoryFormChange = (field: keyof typeof inventoryForm, value: string | number | null) => {
    setInventoryForm({
      ...inventoryForm,
      [field]: field === 'slot' ? parseInt(value as string) || 0 : value,
    });
  };

  const handleInventorySubmit = async (slot: number) => {
    if (!inventory || !inventoryForm) return;
    try {
      const updatedSlots = inventory.Slots.map((s: any) =>
        s.SlotNumber === slot ? { ...s, ItemId: inventoryForm.itemId } : s
      );
      const response = await fetch(`/api/characters/${characterId}/inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Slots: updatedSlots }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to update inventory: ${response.statusText} - ${errorData.details || ''}`);
      }
      // Re-fetch inventory to get updated item details
      const updatedInventory = await (await fetch(`/api/characters/${characterId}/inventory`)).json();
      setInventory(updatedInventory);
      setEditingSlot(null);
      setInventoryForm({ itemId: null, slot: 0 });
      toast({ title: "Inventory Updated", description: `Slot ${slot} saved successfully.` });
    } catch (error: any) {
      console.error("Error updating inventory:", error);
      toast({ title: "Error", description: error.message || "Failed to update inventory.", variant: "destructive" });
    }
  };

  const handleClearSlot = async (slot: number) => {
    if (!inventory) return;
    try {
      const updatedSlots = inventory.Slots.map((s: any) =>
        s.SlotNumber === slot ? { ...s, ItemId: null } : s
      );
      const response = await fetch(`/api/characters/${characterId}/inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Slots: updatedSlots }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to clear slot: ${response.statusText} - ${errorData.details || ''}`);
      }
      // Re-fetch inventory to get updated item details
      const updatedInventory = await (await fetch(`/api/characters/${characterId}/inventory`)).json();
      setInventory(updatedInventory);
      toast({ title: "Slot Cleared", description: `Slot ${slot} cleared.` });
    } catch (error: any) {
      console.error("Error clearing slot:", error);
      toast({ title: "Error", description: error.message || "Failed to clear slot.", variant: "destructive" });
    }
  };

  return { inventory, editingSlot, inventoryForm, handleInventoryEdit, handleInventoryFormChange, handleInventorySubmit, handleClearSlot, loading, error, setInventory };
}