import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

export async function PUT(request: Request, { params }: { params: { id: string; inventoryId: string } }) {
  const characterId = parseInt(params.id);
  const inventoryId = parseInt(params.inventoryId);
  const { contents } = await request.json();
  try {
    const result = await client.execute({
      sql: 'UPDATE Inventory SET Contents = ? WHERE Inventoryid = ? AND CharacterId = ?',
      args: [JSON.stringify(contents), inventoryId, characterId],
    });
    if (result.rowsAffected === 0) {
      return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
    }
    const updatedInventory = await client.execute({
      sql: 'SELECT * FROM Inventory WHERE Inventoryid = ?',
      args: [inventoryId],
    });
    return NextResponse.json(updatedInventory.rows[0]);
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory' },
      { status: 500 }
    );
  }
}