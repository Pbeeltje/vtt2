// app/api/characters/[id]/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client'; // Use Turso client
import { getUserFromCookie } from '@/lib/auth';

// Assuming you have a Job type defined somewhere, e.g., in app/types/job.ts
// import { Job } from '../../../../types/job';

// Define a simple Job type here if not defined elsewhere
interface Job {
  JobId: number;
  CharacterId: number;
  JobName: string;
  Level: number;
  Experience: number;
  Description?: string | null;
}

const client = createClient({
  url: "file:./vttdatabase.db", // Changed to local DB
  authToken: "", // No auth token needed for local file
});

// Helper function to check if the user is authorized (either owner or DM)
// Ensure Character table exists in Turso DB
async function checkAuthorization(characterId: number, user: any): Promise<{ authorized: boolean; error?: string; status?: number }> {
  console.log('Checking authorization for characterId:', characterId, 'user:', user);
  if (!user) {
    console.log('User not authenticated');
    return { authorized: false, error: 'Not authenticated', status: 401 };
  }

  if (user.role === 'DM') {
    console.log('User is a DM, authorization granted');
    return { authorized: true };
  }

  console.log('User is not a DM, checking character ownership');
  try {
    // Use 'Character' table name
    const characterResult = await client.execute({
        sql: 'SELECT UserId FROM Character WHERE CharacterId = ?',
        args: [characterId]
    });

    if (characterResult.rows.length === 0) {
        console.log('Character not found for ID:', characterId);
        return { authorized: false, error: 'Character not found', status: 404 };
    }

    // Ensure UserId column exists and is correctly named in your Turso Character table
    const ownerId = characterResult.rows[0].UserId as number; // Adjust column name if necessary

    if (ownerId !== user.id) {
        console.log('User', user.id, 'does not own character', characterId);
        return { authorized: false, error: 'Not authorized', status: 403 };
    }

  } catch (error) {
    console.error("Database error during authorization check:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    return { authorized: false, error: `Database error during authorization: ${errorMessage}`, status: 500 };
  }

  console.log('User is authorized as the character owner');
  return { authorized: true };
}

// GET all jobs for a character
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  console.log('GET /api/characters/[id]/jobs called with params:', params);

  const characterId = params.id;
  if (!characterId || isNaN(parseInt(characterId))) {
    return NextResponse.json({ error: 'Invalid character ID' }, { status: 400 });
  }

  const charId = parseInt(characterId);
  const user = await getUserFromCookie();

  const authCheck = await checkAuthorization(charId, user);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  try {
    console.log('Fetching jobs for characterId:', charId);
    // Use 'Job' table name (assuming it exists in Turso)
    const result = await client.execute({
        sql:'SELECT * FROM Job WHERE CharacterId = ?',
        args: [charId]
    });

    // Map rows to Job interface, ensure column names match DB
    const jobs: Job[] = result.rows.map(row => ({
        JobId: row.JobId as number,
        CharacterId: row.CharacterId as number,
        JobName: row.JobName as string,
        Level: row.Level as number,
        Experience: row.Experience as number,
        Description: row.Description as string | null,
    }));

    console.log('Returning jobs:', jobs);
    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch jobs', details: errorMessage },
      { status: 500 }
    );
  }
}

// POST a new job for a character
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  console.log('POST /api/characters/[id]/jobs called');

  const characterId = params.id;
  if (!characterId || isNaN(parseInt(characterId))) {
    return NextResponse.json({ error: 'Invalid character ID' }, { status: 400 });
  }

  const charId = parseInt(characterId);
  const user = await getUserFromCookie();

  const authCheck = await checkAuthorization(charId, user);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  try {
    const body = await req.json();
    const { JobName, Level, Experience, Description } = body; // Extract job details from body

    if (!JobName) {
      return NextResponse.json({ error: 'Missing required field: JobName' }, { status: 400 });
    }

    console.log('Inserting new job for characterId:', charId);
    // Use 'Job' table name
    const result = await client.execute({
        sql: `
          INSERT INTO Job (CharacterId, JobName, Level, Experience, Description)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [
            charId,
            JobName,
            Level ?? 1,
            Experience ?? 0,
            Description ?? null
        ]
    });

    const newJobId = result.lastInsertRowid;
    if (newJobId === undefined) {
         throw new Error('Failed to get last insert row ID for new job.');
    }

    console.log('Fetching newly created job');
    // Use 'Job' table name
    const selectResult = await client.execute({
        sql: 'SELECT * FROM Job WHERE JobId = ?',
        args: [newJobId]
    });

     if (selectResult.rows.length === 0) {
        throw new Error('Failed to fetch newly created job.');
    }

    const newJob: Job = {
        JobId: selectResult.rows[0].JobId as number,
        CharacterId: selectResult.rows[0].CharacterId as number,
        JobName: selectResult.rows[0].JobName as string,
        Level: selectResult.rows[0].Level as number,
        Experience: selectResult.rows[0].Experience as number,
        Description: selectResult.rows[0].Description as string | null,
    };

    return NextResponse.json(newJob, { status: 201 }); // 201 Created status

  } catch (error) {
    console.error('Error creating job:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create job', details: errorMessage },
      { status: 500 }
    );
  }
}

// Note: PUT (update) and DELETE for specific jobs would typically go in a
// /api/characters/[id]/jobs/[jobId]/route.ts file.
