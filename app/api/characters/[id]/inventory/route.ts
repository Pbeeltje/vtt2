import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

// Initialize the libSQL client for Turso
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || '', // e.g., "libsql://your-database.turso.io"
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const characterId = searchParams.get('characterId');

  if (!characterId || isNaN(parseInt(characterId))) {
    return NextResponse.json({ error: 'Invalid character ID' }, { status: 400 });
  }

  const charId = parseInt(characterId);

  try {
    // Fetch the inventory for the character
    const result = await client.execute({
      sql: 'SELECT * FROM inventory WHERE character_id = ?',
      args: [charId],
    });

    let inventoryData: {
      Inventoryid: number;
      CharacterId: number;
      Contents: Array<{
        slot: number;
        name: string;
        description: string | null;
      }>;
    };
    if (result.rows.length === 0) {
      // Initialize the inventory with 16 empty slots
      const initialContents = Array.from({ length: 16 }, (_, i) => ({
        slot: i + 1,
        name: '',
        description: null,
      }));
      await client.execute({
        sql: 'INSERT INTO inventory (character_id, contents) VALUES (?, ?)',
        args: [charId, JSON.stringify(initialContents)],
      });

      // Fetch the newly created inventory
      const newResult = await client.execute({
        sql: 'SELECT * FROM inventory WHERE character_id = ?',
        args: [charId],
      });
      inventoryData = {
        Inventoryid: newResult.rows[0].inventory_id as number,
        CharacterId: newResult.rows[0].character_id as number,
        Contents: JSON.parse(newResult.rows[0].contents as string),
      };
    } else {
      inventoryData = {
        Inventoryid: result.rows[0].inventory_id as number,
        CharacterId: result.rows[0].character_id as number,
        Contents: JSON.parse(result.rows[0].contents as string),
      };

      // Ensure the contents array has exactly 16 slots
      if (!Array.isArray(inventoryData.Contents) || inventoryData.Contents.length !== 16) {
        const allSlots = Array.from({ length: 16 }, (_, i) => i + 1);
        const newContents = allSlots.map(slot => {
          const existingItem = inventoryData.Contents.find((item: any) => item.slot === slot);
          return existingItem || { slot, name: '', description: null };
        });
        await client.execute({
          sql: 'UPDATE inventory SET contents = ? WHERE character_id = ?',
          args: [JSON.stringify(newContents), charId],
        });
        inventoryData.Contents = newContents;
      }
    }

    // Sort by slot number (should already be in order, but just to be safe)
    inventoryData.Contents.sort((a: any, b: any) => (a.slot || 0) - (b.slot || 0));
    return NextResponse.json(inventoryData);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { inventoryId, contents } = body;

    if (!inventoryId || !contents) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await client.execute({
      sql: 'UPDATE inventory SET contents = ? WHERE inventory_id = ?',
      args: [JSON.stringify(contents), inventoryId],
    });

    const updatedInventory = await client.execute({
      sql: 'SELECT * FROM inventory WHERE inventory_id = ?',
      args: [inventoryId],
    });
    const updatedData = {
      Inventoryid: updatedInventory.rows[0].inventory_id as number,
      CharacterId: updatedInventory.rows[0].character_id as number,
      Contents: JSON.parse(updatedInventory.rows[0].contents as string),
    };
    return NextResponse.json(updatedData);
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
  }
}