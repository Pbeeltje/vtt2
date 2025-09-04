import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
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

export async function PUT(
  req: NextRequest, 
  { params }: { params: { id: string; slotNumber: string } }
) {
  const characterIdParam = params.id;
  const slotNumberParam = params.slotNumber;
  
  if (!characterIdParam || isNaN(parseInt(characterIdParam))) {
    return NextResponse.json({ error: 'Invalid character ID' }, { status: 400 });
  }
  
  if (!slotNumberParam || isNaN(parseInt(slotNumberParam))) {
    return NextResponse.json({ error: 'Invalid slot number' }, { status: 400 });
  }
  
  const charId = parseInt(characterIdParam);
  const slotNumber = parseInt(slotNumberParam);
  
  const user = await getUserFromCookie();
  const authCheck = await checkAuthorization(charId, user);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status || 403 });
  }
  
  try {
    const body = await req.json();
    const { Name, Description } = body;
    
    if (!Name || Name.trim() === '') {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
    }
    
    // Check if there's already an item in this slot
    const existingItemResult = await client.execute({
      sql: 'SELECT i.ItemId FROM inventory inv JOIN item i ON inv.ItemId = i.ItemId WHERE inv.CharacterId = ? AND i.Slotnumber = ?',
      args: [charId, slotNumber],
    });
    
    if (existingItemResult.rows.length > 0) {
      // Update existing item
      const existingItemId = existingItemResult.rows[0].ItemId;
      await client.execute({
        sql: 'UPDATE item SET Name = ?, Description = ? WHERE ItemId = ?',
        args: [Name.trim(), Description?.trim() || '', existingItemId],
      });
    } else {
      // Create new item
      const newItemResult = await client.execute({
        sql: 'INSERT INTO item (Name, Description, Slotnumber) VALUES (?, ?, ?)',
        args: [Name.trim(), Description?.trim() || '', slotNumber],
      });
      
      // Get the new item ID
      const newItemId = newItemResult.lastInsertRowid;
      
      if (newItemId) {
        // Add to inventory
        await client.execute({
          sql: 'INSERT INTO inventory (CharacterId, ItemId) VALUES (?, ?)',
          args: [charId, newItemId],
        });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PUT inventory slot:', error);
    return NextResponse.json({ error: 'Failed to update inventory slot' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest, 
  { params }: { params: { id: string; slotNumber: string } }
) {
  const characterIdParam = params.id;
  const slotNumberParam = params.slotNumber;
  
  if (!characterIdParam || isNaN(parseInt(characterIdParam))) {
    return NextResponse.json({ error: 'Invalid character ID' }, { status: 400 });
  }
  
  if (!slotNumberParam || isNaN(parseInt(slotNumberParam))) {
    return NextResponse.json({ error: 'Invalid slot number' }, { status: 400 });
  }
  
  const charId = parseInt(characterIdParam);
  const slotNumber = parseInt(slotNumberParam);
  
  const user = await getUserFromCookie();
  const authCheck = await checkAuthorization(charId, user);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status || 403 });
  }
  
  try {
    // Find the item in this slot
    const existingItemResult = await client.execute({
      sql: 'SELECT i.ItemId FROM inventory inv JOIN item i ON inv.ItemId = i.ItemId WHERE inv.CharacterId = ? AND i.Slotnumber = ?',
      args: [charId, slotNumber],
    });
    
    if (existingItemResult.rows.length > 0) {
      const itemId = existingItemResult.rows[0].ItemId;
      
      // Remove from inventory
      await client.execute({
        sql: 'DELETE FROM inventory WHERE CharacterId = ? AND ItemId = ?',
        args: [charId, itemId],
      });
      
      // Delete the item
      await client.execute({
        sql: 'DELETE FROM item WHERE ItemId = ?',
        args: [itemId],
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE inventory slot:', error);
    return NextResponse.json({ error: 'Failed to delete inventory slot' }, { status: 500 });
  }
} 