// app/api/characters/[id]/inventory/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, ResultSet } from '@libsql/client';
import { Inventory, InventoryItem } from '../../../../types/inventory';
import { getUserFromCookie } from '@/lib/auth';

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
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
    args: [characterId],
  });

  if (characterResult.rows.length === 0) {
    console.log('Character not found for ID:', characterId);
    return { authorized: false, error: 'Character not found', status: 404 };
  }
  const ownerId = characterResult.rows[0].UserId as number;
  if (ownerId !== user.id) {
    console.log('User', user.id, 'does not own character', characterId);
    return { authorized: false, error: 'Not authorized', status: 403 };
  }
  console.log('User is authorized as the character owner');
  return { authorized: true };
}

async function getOrCreateInventoryIdForCharacter(charId: number): Promise<number> {
  let characterInventoryId: number | null = null;

  const charLinkResult = await client.execute({
    sql: 'SELECT InventoryId FROM Character WHERE CharacterId = ?',
    args: [charId],
  });

  if (charLinkResult.rows.length > 0 && charLinkResult.rows[0].InventoryId !== null) {
    characterInventoryId = charLinkResult.rows[0].InventoryId as number;
  } else {
    // Character has no InventoryId or it's NULL. Create/assign a new one.
    // This strategy assumes InventoryId is just a number that groups items in the 'inventory' table.
    // A more robust way would be a dedicated 'Inventories' table with an AUTOINCREMENT PK.
    console.log(`No valid InventoryId found for Character ${charId}. Assigning a new one.`);
    
    const maxInvIdResult = await client.execute(
      'SELECT MAX(InventoryId) as maxId FROM (SELECT InventoryId FROM inventory UNION SELECT InventoryId FROM Character WHERE InventoryId IS NOT NULL)'
    );
    const newId = ((maxInvIdResult.rows[0]?.maxId as number) || 0) + 1;
    
    await client.execute({
      sql: 'UPDATE Character SET InventoryId = ? WHERE CharacterId = ?',
      args: [newId, charId],
    });
    characterInventoryId = newId;
    console.log(`Assigned new InventoryId ${characterInventoryId} to Character ${charId}.`);
  }
  if (characterInventoryId === null) { // Should not happen if logic above is correct
      throw new Error (`Failed to get or create an InventoryId for Character ${charId}`);
  }
  return characterInventoryId;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  console.log('GET /api/characters/[id]/inventory called with params:', params);
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
    const characterInventoryId = await getOrCreateInventoryIdForCharacter(charId);

    // Fetch ItemIds associated with this character's InventoryId
    const itemLinksResult = await client.execute({
      sql: 'SELECT ItemId FROM inventory WHERE InventoryId = ?',
      args: [characterInventoryId],
    });

    const fetchedItems: InventoryItem[] = [];
    for (const row of itemLinksResult.rows) {
      const itemId = row.ItemId as number;
      if (itemId === null || itemId === undefined) continue;

      const itemDetailsResult = await client.execute({
        sql: 'SELECT ItemId, Name, Description FROM item WHERE ItemId = ?',
        args: [itemId],
      });

      if (itemDetailsResult.rows.length > 0) {
        const itemDetail = itemDetailsResult.rows[0];
        // Assign to first available slot for now, slot management is primarily a frontend concern
        // or needs DB schema change to store slot position.
        fetchedItems.push({
          slot: 0, // Placeholder, will be assigned below
          itemId: itemDetail.ItemId as number,
          name: itemDetail.Name as string,
          description: itemDetail.Description as string | null,
        });
      }
    }

    // Create 16 slots, fill with fetched items, then empty slots
    const contents: InventoryItem[] = [];
    const targetSlotCount = 16;
    for (let i = 0; i < targetSlotCount; i++) {
      const slotNumber = i + 1;
      if (i < fetchedItems.length) {
        contents.push({ ...fetchedItems[i], slot: slotNumber });
      } else {
        contents.push({ slot: slotNumber, name: '', description: null, itemId: null });
      }
    }

    const inventoryData: Inventory = {
      Inventoryid: characterInventoryId,
      CharacterId: charId,
      Contents: contents,
    };

    return NextResponse.json(inventoryData);

  } catch (error) {
    console.error('Error in GET inventory:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch inventory', details: errorMessage },
      { status: 500 }
    );
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
    const body = await req.json() as Inventory; // Expecting full Inventory object
    const { Inventoryid: inventoryIdFromRequest, Contents: newContents } = body;

    if (inventoryIdFromRequest === undefined || inventoryIdFromRequest === null || !newContents) {
      return NextResponse.json({ error: 'Missing or invalid Inventoryid or Contents in request body' }, { status: 400 });
    }

    // Verify that the inventoryIdFromRequest actually belongs to the character
    const actualCharacterInventoryId = await getOrCreateInventoryIdForCharacter(charId);
    if (actualCharacterInventoryId !== inventoryIdFromRequest) {
      return NextResponse.json({ error: 'Inventory ID mismatch.' }, { status: 403 });
    }

    // Start a transaction
    const tx = await client.transaction('write');
    try {
      // Clear existing items for this inventory
      await tx.execute({
        sql: 'DELETE FROM inventory WHERE InventoryId = ?',
        args: [actualCharacterInventoryId],
      });

      // Insert new items
      for (const item of newContents) {
        if (item.itemId !== null && item.itemId !== undefined) {
          // Ensure the item exists in the 'item' table before linking
          const itemExists = await tx.execute({ 
            sql: 'SELECT ItemId FROM item WHERE ItemId = ?',
            args: [item.itemId]
          });
          if(itemExists.rows.length > 0){
            await tx.execute({
              sql: 'INSERT INTO inventory (InventoryId, ItemId) VALUES (?, ?)',
              args: [actualCharacterInventoryId, item.itemId],
            });
          } else {
            console.warn(`Item with ID ${item.itemId} from request not found in item table. Skipping.`);
          }
        }
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e; // Re-throw to be caught by outer catch
    }

    // Fetch the newly updated inventory to return it (consistent with GET)
    // This re-uses the GET logic essentially
    const itemLinksResult = await client.execute({
        sql: 'SELECT ItemId FROM inventory WHERE InventoryId = ?',
        args: [actualCharacterInventoryId],
    });
    const fetchedItems: InventoryItem[] = [];
    for (const row of itemLinksResult.rows) {
        const itemId = row.ItemId as number;
        if (itemId === null || itemId === undefined) continue;
        const itemDetailsResult = await client.execute({
            sql: 'SELECT ItemId, Name, Description FROM item WHERE ItemId = ?',
            args: [itemId],
        });
        if (itemDetailsResult.rows.length > 0) {
            const itemDetail = itemDetailsResult.rows[0];
            fetchedItems.push({
                slot: 0, // Placeholder, assigned below
                itemId: itemDetail.ItemId as number,
                name: itemDetail.Name as string,
                description: itemDetail.Description as string | null,
            });
        }
    }
    const finalContents: InventoryItem[] = [];
    const targetSlotCount = 16;
    for (let i = 0; i < targetSlotCount; i++) {
        const slotNumber = i + 1;
        if (i < fetchedItems.length) {
            finalContents.push({ ...fetchedItems[i], slot: slotNumber });
        } else {
            finalContents.push({ slot: slotNumber, name: '', description: null, itemId: null });
        }
    }
    const updatedInventoryResponse: Inventory = {
      Inventoryid: actualCharacterInventoryId,
      CharacterId: charId,
      Contents: finalContents,
    };

    return NextResponse.json(updatedInventoryResponse);

  } catch (error) {
    console.error('Error in PUT inventory:', error);
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
