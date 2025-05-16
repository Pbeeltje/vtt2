import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { getUserFromCookie } from '@/lib/auth';

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

export async function PUT(
  request: Request,
  { params }: { params: { id: string; jobId: string } }
) {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const characterId = parseInt(params.id);
  const jobId = parseInt(params.jobId);
  const { name, description, tier } = await request.json();

  try {
    const characterCheck = await client.execute({
      sql: 'SELECT UserId FROM Character WHERE CharacterId = ?',
      args: [characterId],
    });

    if (characterCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    if (user.role !== 'DM' && characterCheck.rows[0].UserId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to update this character' }, { status: 403 });
    }

    const result = await client.execute({
      sql: 'UPDATE Job SET Name = ?, Description = ?, Tier = ? WHERE JobId = ? AND CharacterId = ?',
      args: [name, description, tier, jobId, characterId],
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json({ error: 'Job not found or not updated' }, { status: 404 });
    }

    const updatedJob = await client.execute({
      sql: 'SELECT * FROM Job WHERE JobId = ?',
      args: [jobId],
    });

    return NextResponse.json(updatedJob.rows[0]);
  } catch (error) {
    console.error('Error updating job:', error);
    return NextResponse.json(
      {
        error: 'Failed to update job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}