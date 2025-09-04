// components/character-popup/InventoryTab.tsx
import { useInventory } from '../../hooks/useInventory';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import React from 'react'; // Added missing import for React.Fragment
import { toast } from "@/components/ui/use-toast";

interface InventoryTabProps {
  characterId: number;
  maxStrength: number;
}

export function InventoryTab({ characterId, maxStrength }: InventoryTabProps) {
  const { inventory, editingSlot, inventoryForm, handleInventoryEdit, handleInventoryFormChange, handleInventorySubmit, handleClearSlot, setInventory } = useInventory(characterId);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ item: '', note: '' });

  // Calculate row groups based on MaxStrength
  const strengthHalf = Math.round((maxStrength || 0) / 2);
  
  // Always 4 green rows
  const greenRows = 4;
  
  // Orange rows = strengthHalf
  const orangeRows = strengthHalf;
  
  // Red rows = strengthHalf  
  const redRows = strengthHalf;
  
  // Hidden rows (bright red) - only show if strength reduced and items would be lost
  const hiddenRows = 4; // Fixed number for hidden rows
  
  const totalVisibleRows = greenRows + orangeRows + redRows;
  const allRows = greenRows + orangeRows + redRows + hiddenRows;
  
  // Check if any items would be lost due to strength reduction
  const hasItemsInHiddenRows = (inventory?.Slots ?? []).some((item: any) => 
    item.SlotNumber > totalVisibleRows && (item.ItemId !== null && item.ItemId !== undefined)
  ) || false;

  const getRowBackground = (rowNumber: number) => {
    if (rowNumber <= greenRows) return 'bg-green-100';
    if (rowNumber <= greenRows + orangeRows) return 'bg-orange-100';
    if (rowNumber <= greenRows + orangeRows + redRows) return 'bg-red-100';
    return 'bg-red-300'; // Bright red for hidden rows
  };

  const isRowVisible = (rowNumber: number) => {
    if (rowNumber <= totalVisibleRows) return true;
    return hasItemsInHiddenRows; // Only show hidden rows if items would be lost
  };

  const getItemForRow = (rowNumber: number) => {
    return (inventory?.Slots ?? []).find((item: any) => item.SlotNumber === rowNumber) || { 
      SlotNumber: rowNumber, 
      ItemId: null, 
      item: null 
    };
  };

  const handleEditRow = (rowNumber: number) => {
    const item = getItemForRow(rowNumber);
    setEditForm({ 
      item: item.item?.Name || '', 
      note: item.item?.Description || '' 
    });
    setEditingRow(rowNumber);
  };

  const handleSaveRow = async (rowNumber: number) => {
    try {
      // If both name and description are empty, treat as delete
      if (!editForm.item.trim() && !editForm.note.trim()) {
        await handleClearRow(rowNumber);
        setEditingRow(null);
        return;
      }
      
      // Create or update the item
      const response = await fetch(`/api/characters/${characterId}/inventory/${rowNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          Name: editForm.item.trim(), 
          Description: editForm.note.trim() 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save item');
      }
      
      // Update local state instead of reloading
      const updatedInventory = await (await fetch(`/api/characters/${characterId}/inventory`)).json();
      setInventory(updatedInventory);
      setEditingRow(null);
      toast({ title: "Item Saved", description: `Item in slot ${rowNumber} saved successfully.` });
    } catch (error) {
      console.error('Error saving item:', error);
      toast({ title: "Error", description: "Failed to save item.", variant: "destructive" });
    }
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent, rowNumber: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRow(rowNumber);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleClearRow = async (rowNumber: number) => {
    try {
      const response = await fetch(`/api/characters/${characterId}/inventory/${rowNumber}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to clear slot');
      }
      
      // Update local state instead of reloading
      const updatedInventory = await (await fetch(`/api/characters/${characterId}/inventory`)).json();
      setInventory(updatedInventory);
      toast({ title: "Slot Cleared", description: `Slot ${rowNumber} cleared.` });
    } catch (error) {
      console.error('Error clearing slot:', error);
      toast({ title: "Error", description: "Failed to clear slot.", variant: "destructive" });
    }
  };





  const renderGroupHeader = (startRow: number, endRow: number, text: string) => {
    const isVisible = Array.from({ length: endRow - startRow + 1 }, (_, i) => startRow + i).some(row => isRowVisible(row));
    if (!isVisible) return null;
    
    return (
      <tr key={`header-${startRow}`}>
        <td colSpan={4} className="px-4 py-1 text-xs font-medium text-gray-600 bg-gray-50 border-t-2 border-gray-300">
          {text}
        </td>
      </tr>
    );
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-1 py-0.5 text-left font-semibold w-7">#</th>
              <th className="border border-gray-300 px-1.5 py-0.5 text-left font-semibold">Item</th>
              <th className="border border-gray-300 px-1.5 py-0.5 text-left font-semibold">Note</th>
              <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold w-10"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: allRows }, (_, i) => i + 1).map(rowNumber => {
              // Insert group headers at the right spots
              let header = null;
              if (rowNumber === 1) {
                header = renderGroupHeader(1, greenRows, "Light - hands, pockets, belt");
              } else if (rowNumber === greenRows + 1) {
                header = orangeRows > 0 && renderGroupHeader(greenRows + 1, greenRows + orangeRows, "Moderate - packed, strapped or slung: +2 Gd if empty");
              } else if (rowNumber === greenRows + orangeRows + 1) {
                header = redRows > 0 && renderGroupHeader(greenRows + orangeRows + 1, greenRows + orangeRows + redRows, "Encumbered - large pack, sack or tote: Encumbered if used");
              } else if (rowNumber === greenRows + orangeRows + redRows + 1 && hasItemsInHiddenRows) {
                header = renderGroupHeader(greenRows + orangeRows + redRows + 1, allRows, "Dropped items");
              }

              const item = getItemForRow(rowNumber);
              const isVisible = isRowVisible(rowNumber);
              const bgClass = getRowBackground(rowNumber);
              if (!isVisible) return null;

              return (
                <React.Fragment key={`row-${rowNumber}`}>
                  {header}
                  <tr className={bgClass}>
                    <td className="border border-gray-300 px-1 py-0.5 font-medium w-7 text-sm">
                      {rowNumber}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-0.5">
                      {editingRow === rowNumber ? (
                        <Input
                          value={editForm.item}
                          onChange={(e) => setEditForm(prev => ({ ...prev, item: e.target.value }))}
                          onKeyDown={(e) => handleKeyPress(e, rowNumber)}
                          className="w-full text-sm"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm">{item.item?.Name || ''}</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-0.5">
                      {editingRow === rowNumber ? (
                        <Input
                          value={editForm.note}
                          onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                          onKeyDown={(e) => handleKeyPress(e, rowNumber)}
                          className="w-full text-sm"
                        />
                      ) : (
                        <span className="text-sm">{item.item?.Description || ''}</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-1 py-0.5">
                      {editingRow === rowNumber ? (
                        <div className="flex space-x-1 justify-center">
                          <Button size="sm" onClick={() => handleSaveRow(rowNumber)}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex space-x-1 justify-center">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEditRow(rowNumber)}
                            title="Edit"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>


                          {(item.item?.Name || item.item?.Description) && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleClearRow(rowNumber)}
                              title="Delete item"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {hasItemsInHiddenRows && (
        <div className="mt-4 p-3 bg-red-200 border border-red-300 rounded-lg">
          <p className="text-sm text-red-800">
            ⚠️ Warning: Some items have been dropped due to reduced strength.
          </p>
        </div>
      )}
    </div>
  );
}