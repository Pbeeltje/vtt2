"use client"

import React, { useState } from "react"
import { Edit2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useInventory } from "../../hooks/useInventory"
import { inventoryGroups, type CarryGroup } from "../../lib/inventory"
import type { InventorySlot } from "../../types/inventory"

interface InventoryTabProps {
  characterId: number
  maxStrength: number
}

const GROUPS: Record<CarryGroup, { label: string; row: string }> = {
  light: { label: "Light - hands, pockets, belt", row: "bg-[#15291a]" },
  moderate: { label: "Moderate - packed, strapped or slung: +2 Gd if empty", row: "bg-[#33270f]" },
  encumbered: { label: "Encumbered - large pack, sack or tote: Encumbered if used", row: "bg-[#351610]" },
  dropped: { label: "Dropped items", row: "bg-[#5a1a12]" },
}

const CELL = "border border-[#3f4a3d]"

export function InventoryTab({ characterId, maxStrength }: InventoryTabProps) {
  const { slots, saveSlot, clearSlot } = useInventory(characterId)
  const [editing, setEditing] = useState<{ slot: number; name: string; note: string } | null>(null)

  const bySlot = new Map((slots ?? []).map((s) => [s.SlotNumber, s]))
  const groups = inventoryGroups(maxStrength, slots ?? [])

  const startEdit = (slot: InventorySlot | undefined, slotNumber: number) =>
    setEditing({ slot: slotNumber, name: slot?.item?.Name ?? "", note: slot?.item?.Description ?? "" })

  const save = async () => {
    if (!editing) return
    if (await saveSlot(editing.slot, editing.name, editing.note)) setEditing(null)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      void save()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setEditing(null)
    }
  }

  const editField = (field: "name" | "note", autoFocus = false) => (
    <Input
      value={editing![field]}
      onChange={(e) => setEditing((prev) => prev && { ...prev, [field]: e.target.value })}
      onKeyDown={onKeyDown}
      className="w-full text-sm"
      autoFocus={autoFocus}
    />
  )

  return (
    <div>
      <div className="overflow-x-auto">
        <table className={`w-full border-collapse ${CELL}`}>
          <thead>
            <tr className="bg-[#222b21] text-[var(--jade-gold)]">
              <th className={`${CELL} w-7 px-1 py-0.5 text-left font-semibold`}>#</th>
              <th className={`${CELL} px-1.5 py-0.5 text-left font-semibold`}>Item</th>
              <th className={`${CELL} px-1.5 py-0.5 text-left font-semibold`}>Note</th>
              <th className={`${CELL} w-10 px-1 py-0.5 text-center font-semibold`}></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.kind}>
                <tr>
                  <td colSpan={4} className="jade-sc border-t-2 border-[#4c5746] bg-[#222b21] px-4 py-1 text-xs font-semibold text-[var(--jade-gold)]">
                    {GROUPS[group.kind].label}
                  </td>
                </tr>
                {group.slots.map((n) => {
                  const slot = bySlot.get(n)
                  const isEditing = editing?.slot === n
                  return (
                    <tr key={n} className={GROUPS[group.kind].row}>
                      <td className={`${CELL} w-7 px-1 py-0.5 text-sm font-medium`}>{n}</td>
                      <td className={`${CELL} px-1.5 py-0.5`}>
                        {isEditing ? editField("name", true) : <span className="text-sm">{slot?.item?.Name}</span>}
                      </td>
                      <td className={`${CELL} px-1.5 py-0.5`}>
                        {isEditing ? editField("note") : <span className="text-sm">{slot?.item?.Description}</span>}
                      </td>
                      <td className={`${CELL} px-1 py-0.5`}>
                        <div className="flex justify-center space-x-1">
                          {isEditing ? (
                            <>
                              <Button size="sm" onClick={() => void save()}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => startEdit(slot, n)} title="Edit" disabled={!slots}>
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              {slot?.item && (
                                <Button variant="ghost" size="sm" onClick={() => void clearSlot(n)} title="Delete item">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {groups.some((g) => g.kind === "dropped") && (
        <div className="mt-4 border border-[#7a2a1a] bg-[#351610] p-3">
          <p className="text-sm text-[var(--jade-hit)]">⚠️ Warning: Some items have been dropped due to reduced strength.</p>
        </div>
      )}
    </div>
  )
}
