import { describe, expect, it } from "vitest"
import { inventoryGroups } from "@/app/lib/inventory"
import type { InventorySlot } from "@/app/types/inventory"

const filled = (...numbers: number[]): InventorySlot[] =>
  numbers.map((n) => ({ SlotNumber: n, ItemId: n, item: { ItemId: n, Name: `item ${n}`, Description: null } }))

const shape = (maxStrength: number, slots: InventorySlot[] = []) =>
  inventoryGroups(maxStrength, slots).map((g) => `${g.kind}:${g.slots[0]}-${g.slots[g.slots.length - 1]}`)

describe("inventoryGroups", () => {
  it("splits slots into light, then half max-strength moderate and encumbered", () => {
    expect(shape(6)).toEqual(["light:1-4", "moderate:5-7", "encumbered:8-10"])
    expect(shape(5)).toEqual(["light:1-4", "moderate:5-7", "encumbered:8-10"])
  })

  it("leaves out empty groups", () => {
    expect(shape(0)).toEqual(["light:1-4"])
  })

  it("shows dropped items past the carried slots, up to the last one in use", () => {
    expect(shape(2, filled(1, 9))).toEqual(["light:1-4", "moderate:5-5", "encumbered:6-6", "dropped:7-9"])
    expect(shape(2, filled(1, 6))).toEqual(["light:1-4", "moderate:5-5", "encumbered:6-6"])
  })

  it("never goes past the slots the server keeps", () => {
    expect(shape(20)).toEqual(["light:1-4", "moderate:5-14", "encumbered:15-16"])
  })
})
