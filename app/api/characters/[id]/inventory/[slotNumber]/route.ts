import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseId } from "@/lib/api-errors"
import { requireCharacterAccess } from "@/lib/character-access"

type Params = { params: Promise<{ id: string; slotNumber: string }> }

async function slotParams(params: Params["params"]) {
  const { id, slotNumber } = await params
  const slot = parseId(slotNumber)
  return { charId: parseId(id), slotNumber: slot !== null && slot <= 16 ? slot : null }
}

async function itemInSlot(charId: number, slotNumber: number): Promise<number | null> {
  const result = await db.execute({
    sql: "SELECT i.ItemId FROM inventory inv JOIN item i ON inv.ItemId = i.ItemId WHERE inv.CharacterId = ? AND i.Slotnumber = ?",
    args: [charId, slotNumber],
  })
  return result.rows[0] ? Number(result.rows[0].ItemId) : null
}

/** Creates or renames the item in one slot. */
export async function PUT(req: Request, { params }: Params) {
  const { charId, slotNumber } = await slotParams(params)
  const access = await requireCharacterAccess(charId)
  if (access instanceof NextResponse) return access
  if (!slotNumber) return NextResponse.json({ error: "Invalid slot number" }, { status: 400 })

  try {
    const { Name, Description } = await req.json()
    if (typeof Name !== "string" || !Name.trim() || Name.length > 200) {
      return NextResponse.json({ error: "Item name is required" }, { status: 400 })
    }
    if (Description !== undefined && Description !== null && (typeof Description !== "string" || Description.length > 5000)) {
      return NextResponse.json({ error: "Invalid description" }, { status: 400 })
    }
    const description = typeof Description === "string" ? Description.trim() : ""

    const existingItemId = await itemInSlot(charId!, slotNumber)
    if (existingItemId !== null) {
      await db.execute({
        sql: "UPDATE item SET Name = ?, Description = ? WHERE ItemId = ?",
        args: [Name.trim(), description, existingItemId],
      })
    } else {
      const created = await db.execute({
        sql: "INSERT INTO item (Name, Description, Slotnumber) VALUES (?, ?, ?) RETURNING ItemId",
        args: [Name.trim(), description, slotNumber],
      })
      await db.execute({
        sql: "INSERT INTO inventory (CharacterId, ItemId) VALUES (?, ?)",
        args: [charId, Number(created.rows[0].ItemId)],
      })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in PUT inventory slot:", error)
    return NextResponse.json({ error: "Failed to update inventory slot" }, { status: 500 })
  }
}

/** Removes and deletes the item in one slot. */
export async function DELETE(_req: Request, { params }: Params) {
  const { charId, slotNumber } = await slotParams(params)
  const access = await requireCharacterAccess(charId)
  if (access instanceof NextResponse) return access
  if (!slotNumber) return NextResponse.json({ error: "Invalid slot number" }, { status: 400 })

  try {
    const itemId = await itemInSlot(charId!, slotNumber)
    if (itemId !== null) {
      await db.batch(
        [
          { sql: "DELETE FROM inventory WHERE CharacterId = ? AND ItemId = ?", args: [charId, itemId] },
          { sql: "DELETE FROM item WHERE ItemId = ?", args: [itemId] },
        ],
        "write"
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE inventory slot:", error)
    return NextResponse.json({ error: "Failed to delete inventory slot" }, { status: 500 })
  }
}
