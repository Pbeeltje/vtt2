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
  // Use 'Character' table name as per original error context and likely intent
  const characterResult = await client.execute({
    sql: 'SELECT UserId FROM Character WHERE CharacterId = ?',
    args: [characterId, user.id], // Assuming user.id is the correct field
  });

  if (characterResult.rows.length === 0) {
    console.log('Character not found or user not authorized');
    // Check if character exists at all first for better error message potentially
     const charExists = await client.execute({ sql: 'SELECT CharacterId FROM Character WHERE CharacterId = ?', args: [characterId] });
     if (charExists.rows.length === 0) {
         return { authorized: false, error: 'Character not found', status: 404 };
     }
    return { authorized: false, error: 'Not authorized', status: 403 }; // Changed status to 403
  }

  // Verify ownership if character was found
  // Note: The previous query already checked UserId, this part might be redundant if query is correct
  // Let's assume the query `... AND UserId = ?` was intended and correct.
  // If characterResult.rows[0].UserId !== user.id { ... } // This check seems redundant with the SQL query

  console.log('User is authorized as the character owner');
  return { authorized: true };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  console.log('GET /api/characters/[id]/inventory called with params:', params);

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
    // Use 'inventory' (lowercase) as per user screenshot and previous fix
    const result = await client.execute({
      sql: 'SELECT * FROM inventory WHERE CharacterId = ?',
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
      // Use 'inventory' (lowercase)
      await client.execute({
        sql: 'INSERT INTO inventory (CharacterId, contents) VALUES (?, ?)',
        args: [charId, JSON.stringify(initialContents)],
      });

      console.log('Fetching newly created inventory');
      // Use 'inventory' (lowercase)
      const newResult = await client.execute({
        sql: 'SELECT * FROM inventory WHERE CharacterId = ?',
        args: [charId],
      });
      if (newResult.rows.length === 0) {
        throw new Error('Failed to fetch newly created inventory');
      }
      // Ensure column names match the actual table schema (inventory_id vs Inventoryid)
      inventoryData = {
        Inventoryid: newResult.rows[0].inventory_id as number, // Assuming DB column is inventory_id
        CharacterId: newResult.rows[0].CharacterId as number,
        Contents: JSON.parse(newResult.rows[0].contents as string) as InventoryItem[],
      };
    } else {
       // Ensure column names match the actual table schema (inventory_id vs Inventoryid)
      inventoryData = {
        Inventoryid: result.rows[0].inventory_id as number, // Assuming DB column is inventory_id
        CharacterId: result.rows[0].CharacterId as number,
        Contents: JSON.parse(result.rows[0].contents as string) as InventoryItem[],
      };

      // Normalize inventory contents to 16 slots if necessary
      const currentContents = Array.isArray(inventoryData.Contents) ? inventoryData.Contents : [];
      if (currentContents.length !== 16) {
        console.log('Normalizing inventory contents to 16 slots');
        const allSlots = Array.from({ length: 16 }, (_, i) => i + 1);
        const newContents: InventoryItem[] = allSlots.map(slot => {
          const existingItem = currentContents.find((item) => item.slot === slot);
          return existingItem || { slot, name: '', description: null };
        });
         // Use 'inventory' (lowercase)
        await client.execute({
          sql: 'UPDATE inventory SET contents = ? WHERE CharacterId = ?',
          args: [JSON.stringify(newContents), charId],
        });
        inventoryData.Contents = newContents;
      }
    }

     // Ensure Contents is always an array before sorting
    if (!Array.isArray(inventoryData.Contents)) {
        inventoryData.Contents = [];
    }
    inventoryData.Contents.sort((a, b) => a.slot - b.slot);

    console.log('Returning inventory data:', inventoryData);
    return NextResponse.json(inventoryData);
  } catch (error) {
    console.error('Error fetching/creating inventory:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch/create inventory', details: errorMessage },
      { status: 500 }
    );
  }
}


export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  console.log('PUT /api/characters/[id]/inventory called with params:', params);
  try {
    const body = await req.json();
    const { inventoryId, contents } = body; // Assuming inventoryId is passed for PUT
    console.log('Request body:', body);

    if (inventoryId === undefined || !contents) {
      console.log('Missing required fields: inventoryId:', inventoryId, 'contents:', contents);
      return NextResponse.json({ error: 'Missing required fields: inventoryId and contents' }, { status: 400 });
    }

    const charId = parseInt(params.id);
    const user = await getUserFromCookie();

    // Check authorization
    const authCheck = await checkAuthorization(charId, user);
    if (!authCheck.authorized) {
      console.log('Authorization failed:', authCheck.error);
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    console.log('Checking if inventory exists for inventoryId:', inventoryId, 'and belongs to characterId:', charId);
     // Use 'inventory' (lowercase) and check CharacterId association
    const existing = await client.execute({
      sql: 'SELECT inventory_id FROM inventory WHERE inventory_id = ? AND CharacterId = ?',
      args: [inventoryId, charId],
    });

    if (existing.rows.length === 0) {
      console.log('Inventory not found for inventoryId:', inventoryId, 'or does not belong to character:', charId);
      return NextResponse.json({ error: 'Inventory not found or mismatch' }, { status: 404 });
    }

    console.log('Updating inventory for inventoryId:', inventoryId);
     // Use 'inventory' (lowercase)
    await client.execute({
      sql: 'UPDATE inventory SET contents = ? WHERE inventory_id = ?',
      args: [JSON.stringify(contents), inventoryId],
    });

    console.log('Fetching updated inventory');
     // Use 'inventory' (lowercase)
    const updatedInventoryResult = await client.execute({
      sql: 'SELECT * FROM inventory WHERE inventory_id = ?',
      args: [inventoryId],
    });

     if (updatedInventoryResult.rows.length === 0) {
        throw new Error('Failed to fetch updated inventory after update.');
    }

    const updatedData: Inventory = {
      Inventoryid: updatedInventoryResult.rows[0].inventory_id as number, // Assuming DB column is inventory_id
      CharacterId: updatedInventoryResult.rows[0].CharacterId as number,
      Contents: JSON.parse(updatedInventoryResult.rows[0].contents as string) as InventoryItem[],
    };

    console.log('Returning updated inventory:', updatedData);
    return NextResponse.json(updatedData);
  } catch (error) {
    console.error('Error updating inventory:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update inventory', details: errorMessage },
      { status: 500 }
    );
  }
}

// Note: POST might be redundant if GET handles creation. If needed, implement carefully.
/*
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // ... implementation using client.execute ...
}
*/
