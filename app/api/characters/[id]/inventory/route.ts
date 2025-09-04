// app/api/characters/[id]/inventory/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { Item } from '../../../../types/inventory';
import { getUserFromCookie } from '@/lib/auth';

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

// Helper function to check if the user is authorized (either owner or DM)
async function checkAuthorization(characterId: number, user: any) {
  if (!user) return { authorized: false, error: 'Not authenticated', status: 401 };
  if (user.role === 'DM') return { authorized: true };
  const characterResult = await client.execute({
    sql: 'SELECT userId FROM character WHERE CharacterId = ?',
    args: [characterId],
  });
  if (characterResult.rows.length === 0) return { authorized: false, error: 'Character not found', status: 404 };
  const ownerId = characterResult.rows[0].userId as number;
  if (ownerId !== user.id) return { authorized: false, error: 'Not authorized', status: 403 };
  return { authorized: true };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const characterIdParam = params.id;
  if (!characterIdParam || isNaN(parseInt(characterIdParam))) {
    return NextResponse.json({ error: 'Invalid character ID' }, { status: 400 });
  }
  const charId = parseInt(characterIdParam);
  const user = await getUserFromCookie();
  const authCheck = await checkAuthorization(charId, user);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status || 403 });
  }
  try {
    // Get all inventory slots for this character
    const invRows = await client.execute({
      sql: 'SELECT i.InventoryId, i.ItemId, itm.ItemId as item_ItemId, itm.Name as item_Name, itm.Description as item_Description, itm.Slotnumber FROM inventory i LEFT JOIN item itm ON i.ItemId = itm.ItemId WHERE i.CharacterId = ?',
      args: [charId],
    });
    // Build a map of slotNumber -> slot
    const slotMap = new Map();
    for (const row of invRows.rows) {
      const slotNumber = row.Slotnumber || 1; // Default to slot 1 if no slot number
      slotMap.set(slotNumber, {
        SlotNumber: slotNumber,
        ItemId: row.ItemId,
        item: row.item_ItemId ? {
          ItemId: row.item_ItemId,
          Name: row.item_Name,
          Description: row.item_Description,
        } : null,
      });
    }
    // Always return 16 slots, filling in empty ones
    const slots = [];
    for (let slot = 1; slot <= 16; slot++) {
      if (slotMap.has(slot)) {
        slots.push(slotMap.get(slot));
      } else {
        slots.push({ SlotNumber: slot, ItemId: null, item: null });
      }
    }
    return NextResponse.json({
      CharacterId: charId,
      Slots: slots,
    });
  } catch (error) {
    console.error('Error in GET inventory:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const characterIdParam = params.id;
  if (!characterIdParam || isNaN(parseInt(characterIdParam))) {
    return NextResponse.json({ error: 'Invalid character ID' }, { status: 400 });
  }
  const charId = parseInt(characterIdParam);
  const user = await getUserFromCookie();
  const authCheck = await checkAuthorization(charId, user);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status || 403 });
  }
  try {
    const body = await req.json();
    const { Slots } = body;
    if (!Slots) {
      return NextResponse.json({ error: 'Missing Slots' }, { status: 400 });
    }
    // Upsert each slot
    for (const slot of Slots) {
      const safeItemId = slot.ItemId === undefined ? null : slot.ItemId;
      if (safeItemId) {
        // Update the item's slot number
        await client.execute({
          sql: 'UPDATE item SET Slotnumber = ? WHERE ItemId = ?',
          args: [slot.SlotNumber, safeItemId],
        });
        // Insert or update inventory entry
        await client.execute({
          sql: `INSERT INTO inventory (CharacterId, ItemId)
                 VALUES (?, ?)
                 ON CONFLICT(CharacterId, ItemId) DO UPDATE SET ItemId=excluded.ItemId`,
          args: [charId, safeItemId],
        });
      } else {
        // Remove item from inventory if ItemId is null
        await client.execute({
          sql: 'DELETE FROM inventory WHERE CharacterId = ? AND ItemId IN (SELECT ItemId FROM item WHERE Slotnumber = ?)',
          args: [charId, slot.SlotNumber],
        });
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PUT inventory:', error);
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
  }
}

// Note: POST might be redundant if GET handles creation. If needed, implement carefully.
/*
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // ... implementation using client.execute ...
}
*/
