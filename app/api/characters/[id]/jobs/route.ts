import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { getUserFromCookie } from '@/lib/auth';

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
    const result = await client.execute({
      sql: 'SELECT * FROM Job WHERE CharacterId = ?',
      args: [characterId],
    });

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs', details: error instanceof Error ? error.message : 'Unknown error' },
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
  const { name, description, tier } = await request.json();

  try {
    const characterCheck = await client.execute({
      sql: 'SELECT UserId FROM Character WHERE CharacterId = ?',
      args: [characterId],
    });

    if (characterCheck.rows.length === 0 || characterCheck.rows[0].UserId !== user.id) {
      return NextResponse.json({ error: 'Character not found or not authorized' }, { status: 403 });
    }

    const result = await client.execute({
      sql: 'INSERT INTO Job (Name, Description, Tier, CharacterId) VALUES (?, ?, ?, ?)',
      args: [name, description, tier, characterId],
    });

    const newJob = await client.execute({
      sql: 'SELECT * FROM Job WHERE JobId = ?',
      args: [result.lastInsertRowid ?? (() => { throw new Error('lastInsertRowid is undefined'); })()],
    });

    return NextResponse.json(newJob.rows[0]);
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { error: 'Failed to create job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}