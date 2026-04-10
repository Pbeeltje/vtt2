// app/api/characters/[id]/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client'; // Use Turso client
import { getUserFromCookie } from '@/lib/auth';

// Assuming you have a Job type defined somewhere, e.g., in app/types/job.ts
// import { Job } from '../../../../types/job';

/** Matches `job` table: Name, Tier, Description, CharacterId */
interface JobRow {
  JobId: number;
  CharacterId: number;
  Name: string;
  Tier: number;
  Description: string | null;
}

const client = createClient({
  url: "file:./vttdatabase.db", // Changed to local DB
  authToken: "", // No auth token needed for local file
});

// Helper function to check if the user is authorized (either owner or DM)
// Ensure Character table exists in Turso DB
async function checkAuthorization(characterId: number, user: any): Promise<{ authorized: boolean; error?: string; status?: number }> {
  if (!user) {
    return { authorized: false, error: 'Not authenticated', status: 401 };
  }

  if (user.role === 'DM') {
    return { authorized: true };
  }

  try {
    // Use 'Character' table name
    const characterResult = await client.execute({
        sql: 'SELECT UserId FROM Character WHERE CharacterId = ?',
        args: [characterId]
    });

    if (characterResult.rows.length === 0) {
        return { authorized: false, error: 'Character not found', status: 404 };
    }

    // Ensure UserId column exists and is correctly named in your Turso Character table
    const ownerId = characterResult.rows[0].UserId as number; // Adjust column name if necessary

    if (ownerId !== user.id) {
        return { authorized: false, error: 'Not authorized', status: 403 };
    }

  } catch (error) {
    console.error("Database error during authorization check:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    return { authorized: false, error: `Database error during authorization: ${errorMessage}`, status: 500 };
  }

  return { authorized: true };
}

// GET all jobs for a character
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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
    const result = await client.execute({
        sql:'SELECT * FROM Job WHERE CharacterId = ?',
        args: [charId]
    });

    const jobs: JobRow[] = result.rows.map((row) => ({
      JobId: row.JobId as number,
      CharacterId: row.CharacterId as number,
      Name: (row.Name ?? row.name) as string,
      Tier: (row.Tier ?? row.tier ?? 1) as number,
      Description: (row.Description ?? row.description ?? null) as string | null,
    }));

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
    const name = body.name ?? body.JobName;
    const tierRaw = body.tier ?? body.Level ?? 1;
    const tierParsed =
      typeof tierRaw === "string" ? parseInt(tierRaw, 10) : Number(tierRaw);
    const tier = Number.isFinite(tierParsed) && tierParsed > 0 ? tierParsed : 1;
    const description =
      body.description !== undefined ? body.description : body.Description ?? null;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }

    const result = await client.execute({
      sql: `
        INSERT INTO Job (CharacterId, Name, Tier, Description)
        VALUES (?, ?, ?, ?)
      `,
      args: [charId, name.trim(), tier, description],
    });

    const newJobId = result.lastInsertRowid;
    if (newJobId === undefined) {
         throw new Error('Failed to get last insert row ID for new job.');
    }

    const jobIdNum = typeof newJobId === "bigint" ? Number(newJobId) : Number(newJobId);

    const selectResult = await client.execute({
        sql: 'SELECT * FROM Job WHERE JobId = ?',
        args: [jobIdNum]
    });

     if (selectResult.rows.length === 0) {
        throw new Error('Failed to fetch newly created job.');
    }

    const r = selectResult.rows[0];
    const newJob: JobRow = {
      JobId: r.JobId as number,
      CharacterId: r.CharacterId as number,
      Name: (r.Name ?? r.name) as string,
      Tier: (r.Tier ?? r.tier ?? 1) as number,
      Description: (r.Description ?? r.description ?? null) as string | null,
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
