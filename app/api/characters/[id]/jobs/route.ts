// app/api/characters/[id]/inventory/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { getUserFromCookie } from '@/lib/auth';
import { Inventory, InventoryItem } from '../../../../types/inventory';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const characterId = parseInt(params.id);

  try {
    // Check if the user owns the character or is a DM
    const characterCheck = await client.execute({
      sql: 'SELECT UserId FROM Character WHERE CharacterId = ?',
      args: [characterId],
    });

    if (characterCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    if (user.role !== 'DM' && characterCheck.rows[0].UserId !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Fetch the inventory
    const result = await client.execute({
      sql: 'SELECT * FROM Inventory WHERE CharacterId = ?',
      args: [characterId],
    });

    let inventoryData: Inventory;
    if (result.rows.length === 0) {
      console.log('No inventory found, creating a new one for characterId:', characterId);
      const initialContents: InventoryItem[] = Array.from({ length: 16 }, (_, i) => ({
        slot: i + 1,
        name: '',
        description: null,
      }));
      await client.execute({
        sql: 'INSERT INTO Inventory (CharacterId, contents) VALUES (?, ?)',
        args: [characterId, JSON.stringify(initialContents)],
      });

      const newResult = await client.execute({
        sql: 'SELECT * FROM Inventory WHERE CharacterId = ?',
        args: [characterId],
      });

      if (newResult.rows.length === 0) {
        throw new Error('Failed to fetch newly created inventory');
      }

      inventoryData = {
        Inventoryid: newResult.rows[0].inventory_id as number,
        CharacterId: newResult.rows[0].CharacterId as number,
        Contents: JSON.parse(newResult.rows[0].contents as string) as InventoryItem[],
      };
    } else {
      inventoryData = {
        Inventoryid: result.rows[0].inventory_id as number,
        CharacterId: result.rows[0].CharacterId as number,
        Contents: JSON.parse(result.rows[0].contents as string) as InventoryItem[],
      };

      // Normalize inventory contents to 16 slots if necessary
      if (!Array.isArray(inventoryData.Contents) || inventoryData.Contents.length !== 16) {
        const allSlots = Array.from({ length: 16 }, (_, i) => i + 1);
        const newContents: InventoryItem[] = allSlots.map(slot => {
          const existingItem = inventoryData.Contents.find((item) => item.slot === slot);
          return existingItem || { slot, name: '', description: null };
        });
        await client.execute({
          sql: 'UPDATE Inventory SET contents = ? WHERE CharacterId = ?',
          args: [JSON.stringify(newContents), characterId],
        });
        inventoryData.Contents = newContents;
      }
    }

    inventoryData.Contents.sort((a, b) => a.slot - b.slot);
    return NextResponse.json(inventoryData);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const characterId = parseInt(params.id);
  const { contents } = await request.json();

  try {
    // Check if the user owns the character or is a DM
    const characterCheck = await client.execute({
      sql: 'SELECT UserId FROM Character WHERE CharacterId = ?',
      args: [characterId],
    });

    if (characterCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    if (user.role !== 'DM' && characterCheck.rows[0].UserId !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Check if inventory already exists
    const existing = await client.execute({
      sql: 'SELECT * FROM Inventory WHERE CharacterId = ?',
      args: [characterId],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Inventory already exists for this character' }, { status: 400 });
    }

    const result = await client.execute({
      sql: 'INSERT INTO Inventory (CharacterId, contents) VALUES (?, ?)',
      args: [characterId, JSON.stringify(contents)],
    });

    const newInventoryResult = await client.execute({
      sql: 'SELECT * FROM Inventory WHERE inventory_id = ?',
      args: [result.lastInsertRowid ?? (() => { throw new Error('lastInsertRowid is undefined'); })()],
    });

    const newInventory: Inventory = {
      Inventoryid: newInventoryResult.rows[0].inventory_id as number,
      CharacterId: newInventoryResult.rows[0].CharacterId as number,
      Contents: JSON.parse(newInventoryResult.rows[0].contents as string) as InventoryItem[],
    };

    return NextResponse.json(newInventory);
  } catch (error) {
    console.error('Error creating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to create inventory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const characterId = parseInt(params.id);
  const { inventoryId, contents } = await request.json();

  try {
    // Check if the user owns the character or is a DM
    const characterCheck = await client.execute({
      sql: 'SELECT UserId FROM Character WHERE CharacterId = ?',
      args: [characterId],
    });

    if (characterCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    if (user.role !== 'DM' && characterCheck.rows[0].UserId !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const existing = await client.execute({
      sql: 'SELECT * FROM Inventory WHERE inventory_id = ?',
      args: [inventoryId],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
    }

    await client.execute({
      sql: 'UPDATE Inventory SET contents = ? WHERE inventory_id = ?',
      args: [JSON.stringify(contents), inventoryId],
    });

    const updatedInventory = await client.execute({
      sql: 'SELECT * FROM Inventory WHERE inventory_id = ?',
      args: [inventoryId],
    });

    const updatedData: Inventory = {
      Inventoryid: updatedInventory.rows[0].inventory_id as number,
      CharacterId: updatedInventory.rows[0].CharacterId as number,
      Contents: JSON.parse(updatedInventory.rows[0].contents as string) as InventoryItem[],
    };

    return NextResponse.json(updatedData);
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}