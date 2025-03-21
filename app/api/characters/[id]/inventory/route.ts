// app/api/characters/[id]/inventory/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { Inventory, InventoryItem } from '../../../../types/inventory';
import { getUserFromCookie } from '@/lib/auth';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

// Helper function to check if the user is authorized (either owner or DM)
async function checkAuthorization(characterId: number, user: any) {
  console.log('Checking authorization for characterId:', characterId, 'user:', user);
  if (!user) {
    console.log('User not authenticated');
    return { authorized: false, error: 'Not authenticated', status: 401 };
  }

  // If the user is a DM, they are authorized for all characters
  if (user.role === 'DM') {
    console.log('User is a DM, authorization granted');
    return { authorized: true };
  }

  // For non-DM users, check if they own the character
  console.log('User is not a DM, checking character ownership');
  const characterResult = await client.execute({
    sql: 'SELECT * FROM Character WHERE CharacterId = ? AND UserId = ?',
    args: [characterId, user.id],
  });

  if (characterResult.rows.length === 0) {
    console.log('Character not found or user not authorized');
    return { authorized: false, error: 'Character not found or not authorized', status: 404 };
  }

  console.log('User is authorized as the character owner');
  return { authorized: true };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  console.log('GET /api/characters/[id]/inventory called with params:', params);
  console.log('TURSO_DATABASE_URL:', process.env.TURSO_DATABASE_URL);
  console.log('TURSO_AUTH_TOKEN:', process.env.TURSO_AUTH_TOKEN);

  const characterId = params.id;

  if (!characterId || isNaN(parseInt(characterId))) {
    console.log('Invalid character ID:', characterId);
    return NextResponse.json({ error: 'Invalid character ID' }, { status: 400 });
  }

  const charId = parseInt(characterId);
  const user = await getUserFromCookie();

  // Check authorization
  const authCheck = await checkAuthorization(charId, user);
  if (!authCheck.authorized) {
    console.log('Authorization failed:', authCheck.error);
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  try {
    console.log('Fetching inventory for characterId:', charId);
    const result = await client.execute({
      sql: 'SELECT * FROM Inventory WHERE CharacterId = ?',
      args: [charId],
    });

    let inventoryData: Inventory;
    if (result.rows.length === 0) {
      console.log('No inventory found, creating a new one for characterId:', charId);
      const initialContents: InventoryItem[] = Array.from({ length: 16 }, (_, i) => ({
        slot: i + 1,
        name: '',
        description: null,
      }));
      await client.execute({
        sql: 'INSERT INTO Inventory (CharacterId, contents) VALUES (?, ?)',
        args: [charId, JSON.stringify(initialContents)],
      });

      console.log('Fetching newly created inventory');
      const newResult = await client.execute({
        sql: 'SELECT * FROM Inventory WHERE CharacterId = ?',
        args: [charId],
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

      if (!Array.isArray(inventoryData.Contents) || inventoryData.Contents.length !== 16) {
        console.log('Normalizing inventory contents to 16 slots');
        const allSlots = Array.from({ length: 16 }, (_, i) => i + 1);
        const newContents: InventoryItem[] = allSlots.map(slot => {
          const existingItem = inventoryData.Contents.find((item) => item.slot === slot);
          return existingItem || { slot, name: '', description: null };
        });
        await client.execute({
          sql: 'UPDATE Inventory SET contents = ? WHERE CharacterId = ?',
          args: [JSON.stringify(newContents), charId],
        });
        inventoryData.Contents = newContents;
      }
    }

    inventoryData.Contents.sort((a, b) => a.slot - b.slot);
    console.log('Returning inventory data:', inventoryData);
    return NextResponse.json(inventoryData);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  console.log('POST /api/characters/[id]/inventory called with params:', params);
  try {
    const body = await req.json();
    const { contents } = body;
    console.log('Request body:', body);

    const charId = parseInt(params.id);

    if (!charId || !contents) {
      console.log('Missing required fields: charId:', charId, 'contents:', contents);
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const user = await getUserFromCookie();

    // Check authorization
    const authCheck = await checkAuthorization(charId, user);
    if (!authCheck.authorized) {
      console.log('Authorization failed:', authCheck.error);
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    // Check if inventory already exists
    console.log('Checking if inventory exists for characterId:', charId);
    const existing = await client.execute({
      sql: 'SELECT * FROM Inventory WHERE CharacterId = ?',
      args: [charId],
    });

    if (existing.rows.length > 0) {
      console.log('Inventory already exists for characterId:', charId);
      return NextResponse.json({ error: 'Inventory already exists for this character' }, { status: 400 });
    }

    console.log('Inserting new inventory for characterId:', charId);
    await client.execute({
      sql: 'INSERT INTO Inventory (CharacterId, contents) VALUES (?, ?)',
      args: [charId, JSON.stringify(contents)],
    });

    console.log('Fetching newly created inventory');
    const newResult = await client.execute({
      sql: 'SELECT * FROM Inventory WHERE CharacterId = ?',
      args: [charId],
    });

    const newInventory: Inventory = {
      Inventoryid: newResult.rows[0].inventory_id as number,
      CharacterId: newResult.rows[0].CharacterId as number,
      Contents: JSON.parse(newResult.rows[0].contents as string) as InventoryItem[],
    };

    console.log('Returning new inventory:', newInventory);
    return NextResponse.json(newInventory);
  } catch (error) {
    console.error('Error creating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to create inventory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  console.log('PUT /api/characters/[id]/inventory called with params:', params);
  try {
    const body = await req.json();
    const { inventoryId, contents } = body;
    console.log('Request body:', body);

    if (!inventoryId || !contents) {
      console.log('Missing required fields: inventoryId:', inventoryId, 'contents:', contents);
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const charId = parseInt(params.id);
    const user = await getUserFromCookie();

    // Check authorization
    const authCheck = await checkAuthorization(charId, user);
    if (!authCheck.authorized) {
      console.log('Authorization failed:', authCheck.error);
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    console.log('Checking if inventory exists for inventoryId:', inventoryId);
    const existing = await client.execute({
      sql: 'SELECT * FROM Inventory WHERE inventory_id = ?',
      args: [inventoryId],
    });

    if (existing.rows.length === 0) {
      console.log('Inventory not found for inventoryId:', inventoryId);
      return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
    }

    console.log('Updating inventory for inventoryId:', inventoryId);
    await client.execute({
      sql: 'UPDATE Inventory SET contents = ? WHERE inventory_id = ?',
      args: [JSON.stringify(contents), inventoryId],
    });

    console.log('Fetching updated inventory');
    const updatedInventory = await client.execute({
      sql: 'SELECT * FROM Inventory WHERE inventory_id = ?',
      args: [inventoryId],
    });
    const updatedData: Inventory = {
      Inventoryid: updatedInventory.rows[0].inventory_id as number,
      CharacterId: updatedInventory.rows[0].CharacterId as number,
      Contents: JSON.parse(updatedInventory.rows[0].contents as string) as InventoryItem[],
    };

    console.log('Returning updated inventory:', updatedData);
    return NextResponse.json(updatedData);
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
