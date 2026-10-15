// app/api/characters/[id]/inventory/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseId } from "@/lib/api-errors"
import { requireCharacterAccess } from "@/lib/character-access"

type Params = { params: Promise<{ id: string }> }

const SLOT_COUNT = 16

/** The character's 16 inventory slots, empty ones included. */
export async function GET(_req: Request, { params }: Params) {
  const charId = parseId((await params).id)
  const access = await requireCharacterAccess(charId)
  if (access instanceof NextResponse) return access
  try {
    const invRows = await db.execute({
      sql: `SELECT itm.ItemId, itm.Name, itm.Description, itm.Slotnumber
            FROM inventory i JOIN item itm ON i.ItemId = itm.ItemId
            WHERE i.CharacterId = ?`,
      args: [charId],
    })
    const bySlot = new Map<number, { ItemId: number; Name: string; Description: string | null }>()
    for (const row of invRows.rows) {
      bySlot.set(Number(row.Slotnumber) || 1, {
        ItemId: Number(row.ItemId),
        Name: String(row.Name ?? ""),
        Description: row.Description === null ? null : String(row.Description),
      })
    }
    const slots = Array.from({ length: SLOT_COUNT }, (_, i) => {
      const item = bySlot.get(i + 1)
      return { SlotNumber: i + 1, ItemId: item?.ItemId ?? null, item: item ?? null }
    })
    return NextResponse.json({ CharacterId: charId, Slots: slots })
  } catch (error) {
    console.error("Error in GET inventory:", error)
    return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 })
  }
}

/**
 * Rearranges items between slots: each slot names the item it should hold (null = empty it,
 * which deletes the item). Only items this character already owns can be placed.
 */
export async function PUT(req: Request, { params }: Params) {
  const charId = parseId((await params).id)
  const access = await requireCharacterAccess(charId)
  if (access instanceof NextResponse) return access
  try {
    const { Slots } = await req.json()
    if (!Array.isArray(Slots)) {
      return NextResponse.json({ error: "Missing Slots" }, { status: 400 })
    }

    const owned = await db.execute({
      sql: "SELECT i.ItemId, itm.Slotnumber FROM inventory i JOIN item itm ON i.ItemId = itm.ItemId WHERE i.CharacterId = ?",
      args: [charId],
    })
    const ownedIds = new Set(owned.rows.map((row) => Number(row.ItemId)))
    const statements: { sql: string; args: (number | null)[] }[] = []

    for (const slot of Slots) {
      const slotNumber = Number(slot?.SlotNumber)
      if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > SLOT_COUNT) {
        return NextResponse.json({ error: "Invalid slot number" }, { status: 400 })
      }
      if (slot.ItemId === null || slot.ItemId === undefined) {
        for (const row of owned.rows) {
          if (Number(row.Slotnumber) !== slotNumber) continue
          statements.push(
            { sql: "DELETE FROM inventory WHERE CharacterId = ? AND ItemId = ?", args: [charId, Number(row.ItemId)] },
            { sql: "DELETE FROM item WHERE ItemId = ?", args: [Number(row.ItemId)] }
          )
        }
        continue
      }
      const itemId = Number(slot.ItemId)
      if (!ownedIds.has(itemId)) {
        return NextResponse.json({ error: "Item does not belong to this character" }, { status: 403 })
      }
      statements.push({ sql: "UPDATE item SET Slotnumber = ? WHERE ItemId = ?", args: [slotNumber, itemId] })
    }

    if (statements.length > 0) await db.batch(statements, "write")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in PUT inventory:", error)
    return NextResponse.json({ error: "Failed to update inventory" }, { status: 500 })
  }
}
