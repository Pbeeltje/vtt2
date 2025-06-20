// app/hooks/useInventory.ts
import { useState, useEffect } from 'react';
import { toast } from "@/components/ui/use-toast";
import { Inventory, InventoryItem } from '../types/inventory';

export function useInventory(characterId: number) {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [inventoryForm, setInventoryForm] = useState<{ name: string; description: string | null; slot: number }>({
    name: '',
    description: null,
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
    const item = inventory?.Contents.find(item => item.slot === slot) || { slot, name: '', description: null };
    setInventoryForm({ name: item.name, description: item.description, slot: item.slot });
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
      let inventoryId = inventory.Inventoryid;
      let contents = inventory.Contents;

      // If inventory doesn't exist (Inventoryid is -1), create a new one
      if (inventoryId === -1) {
        const initialContents: InventoryItem[] = Array.from({ length: 16 }, (_, i) => ({
          slot: i + 1,
          name: '',
          description: null,
        }));
        const createResponse = await fetch(`/api/characters/${characterId}/inventory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: initialContents }),
        });
        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          throw new Error(`Failed to create inventory: ${createResponse.statusText} - ${errorData.details || ''}`);
        }
        const createdInventory: Inventory = await createResponse.json();
        inventoryId = createdInventory.Inventoryid;
        contents = createdInventory.Contents;
        setInventory(createdInventory);
      }

      // Update the contents with the new data
      const updatedContents: InventoryItem[] = contents.map(item =>
        item.slot === slot
          ? { slot, name: inventoryForm.name, description: inventoryForm.description }
          : item
      );

      // Update the inventory
      const response = await fetch(`/api/characters/${characterId}/inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId, contents: updatedContents }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to update inventory: ${response.statusText} - ${errorData.details || ''}`);
      }
      const updatedInventory: Inventory = await response.json();
      setInventory(updatedInventory);
      setEditingSlot(null);
      setInventoryForm({ name: '', description: null, slot: 0 });
      toast({ title: "Inventory Updated", description: `Slot ${slot} saved successfully.` });
    } catch (error: any) {
      console.error("Error updating inventory:", error);
      toast({ title: "Error", description: error.message || "Failed to update inventory.", variant: "destructive" });
    }
  };

  const handleClearSlot = async (slot: number) => {
    if (!inventory) return;

    try {
      let inventoryId = inventory.Inventoryid;
      let contents = inventory.Contents;

      // If inventory doesn't exist (Inventoryid is -1), create a new one
      if (inventoryId === -1) {
        const initialContents: InventoryItem[] = Array.from({ length: 16 }, (_, i) => ({
          slot: i + 1,
          name: '',
          description: null,
        }));
        const createResponse = await fetch(`/api/characters/${characterId}/inventory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: initialContents }),
        });
        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          throw new Error(`Failed to create inventory: ${createResponse.statusText} - ${errorData.details || ''}`);
        }
        const createdInventory: Inventory = await createResponse.json();
        inventoryId = createdInventory.Inventoryid;
        contents = createdInventory.Contents;
        setInventory(createdInventory);
      }

      // Update the contents to clear the slot
      const updatedContents: InventoryItem[] = contents.map(item =>
        item.slot === slot ? { slot, name: '', description: null } : item
      );

      // Update the inventory
      const response = await fetch(`/api/characters/${characterId}/inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId, contents: updatedContents }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to clear slot: ${response.statusText} - ${errorData.details || ''}`);
      }
      const updatedInventory: Inventory = await response.json();
      setInventory(updatedInventory);
      toast({ title: "Slot Cleared", description: `Slot ${slot} cleared.` });
    } catch (error: any) {
      console.error("Error clearing slot:", error);
      toast({ title: "Error", description: error.message || "Failed to clear slot.", variant: "destructive" });
    }
  };

  return { inventory, editingSlot, inventoryForm, handleInventoryEdit, handleInventoryFormChange, handleInventorySubmit, handleClearSlot, loading, error };
}