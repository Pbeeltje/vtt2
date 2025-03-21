// components/character-popup/InventoryTab.tsx
import { useInventory } from '../../hooks/useInventory';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Trash2 } from 'lucide-react';

interface InventoryTabProps {
  characterId: number;
  maxStrength: number;
}

export function InventoryTab({ characterId, maxStrength }: InventoryTabProps) {
  const { inventory, editingSlot, inventoryForm, handleInventoryEdit, handleInventoryFormChange, handleInventorySubmit, handleClearSlot } = useInventory(characterId);

  const maxCarrySlots = Math.ceil((maxStrength || 0) / 2);
  const totalSlots = 16;
  const availableSlots = Math.min(maxCarrySlots, totalSlots - 4) + 4;
  const allSlots = Array.from({ length: 16 }, (_, i) => i + 1);

  return (
    <div className="min-h-[500px]">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Belt & Hand (Slots 1–4)</h3>
          <ul className="grid grid-cols-2 gap-4">
            {allSlots.slice(0, 4).map(slot => {
              const item = inventory?.Contents.find(item => item.slot === slot) || { slot, name: '', description: null };
              return (
                <li key={slot} className="border p-4 rounded-lg">
                  {editingSlot === slot ? (
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor={`inv-name-${slot}`}>Name</Label>
                        <Input id={`inv-name-${slot}`} value={inventoryForm?.name || ''} onChange={(e) => handleInventoryFormChange('name', e.target.value)} className="w-full max-w-[200px]" autoFocus />
                      </div>
                      <div>
                        <Label htmlFor={`inv-slot-${slot}`}>Slot</Label>
                        <Input id={`inv-slot-${slot}`} type="number" value={slot} disabled className="w-16" />
                      </div>
                      <div>
                        <Label htmlFor={`inv-desc-${slot}`}>Description</Label>
                        <Textarea id={`inv-desc-${slot}`} value={inventoryForm?.description || ''} onChange={(e) => handleInventoryFormChange('description', e.target.value)} className="w-full max-w-[200px] min-h-[100px]" />
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" onClick={() => handleInventorySubmit(slot)}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => { handleInventoryEdit(0); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium">Slot {slot}: {item.name || 'Empty'}</span>
                        <p className="text-sm text-muted-foreground mt-1">{item.description || 'No description'}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleInventoryEdit(slot)}><Edit2 className="h-4 w-4" /></Button>
                        {item.name && (
                          <Button variant="ghost" size="sm" onClick={() => handleClearSlot(slot)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Pack (Slots 5–16)</h3>
          <ul className="grid grid-cols-2 gap-4">
            {allSlots.slice(4, 16).map(slot => {
              const item = inventory?.Contents.find(item => item.slot === slot) || { slot, name: '', description: null };
              const isOverCapacity = slot > availableSlots;
              return (
                <li key={slot} className={`border p-4 rounded-lg ${isOverCapacity ? 'bg-red-100' : ''}`}>
                  {editingSlot === slot ? (
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor={`inv-name-${slot}`}>Name</Label>
                        <Input id={`inv-name-${slot}`} value={inventoryForm?.name || ''} onChange={(e) => handleInventoryFormChange('name', e.target.value)} className="w-full max-w-[200px]" autoFocus />
                      </div>
                      <div>
                        <Label htmlFor={`inv-slot-${slot}`}>Slot</Label>
                        <Input id={`inv-slot-${slot}`} type="number" value={slot} disabled className="w-16" />
                      </div>
                      <div>
                        <Label htmlFor={`inv-desc-${slot}`}>Description</Label>
                        <Textarea id={`inv-desc-${slot}`} value={inventoryForm?.description || ''} onChange={(e) => handleInventoryFormChange('description', e.target.value)} className="w-full max-w-[200px] min-h-[100px]" />
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" onClick={() => handleInventorySubmit(slot)}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => { handleInventoryEdit(0); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium">Slot {slot}: {item.name || 'Empty'}</span>
                        <p className="text-sm text-muted-foreground mt-1">{item.description || 'No description'}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleInventoryEdit(slot)}><Edit2 className="h-4 w-4" /></Button>
                        {item.name && (
                          <Button variant="ghost" size="sm" onClick={() => handleClearSlot(slot)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}