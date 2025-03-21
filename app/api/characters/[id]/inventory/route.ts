import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const characterId = parseInt(params.id);
  try {
    const result = await client.execute({
      sql: 'SELECT * FROM Inventory WHERE CharacterId = ?',
      args: [characterId],
    });
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const characterId = parseInt(params.id);
  const { contents } = await request.json();
  try {
    const result = await client.execute({
      sql: 'INSERT INTO Inventory (Contents, CharacterId) VALUES (?, ?)',
      args: [JSON.stringify(contents), characterId],
    });
    const newInventory = await client.execute({
      sql: 'SELECT * FROM Inventory WHERE Inventoryid = last_insert_rowid()',
      args: [],
    });
    return NextResponse.json(newInventory.rows[0]);
  } catch (error) {
    console.error('Error adding inventory:', error);
    return NextResponse.json(
      { error: 'Failed to add inventory' },
      { status: 500 }
    );
  }
}