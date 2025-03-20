import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { getUserFromCookie } from "@/lib/auth";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const characterId = parseInt(params.id);

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("Database configuration is missing");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const result = await client.execute({
      sql: "SELECT * FROM Job WHERE CharacterId = ?",
      args: [characterId],
    });

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const characterId = parseInt(params.id);
  const { JobId, Name, Description, Tier } = await request.json();

  try {
    const updatedJob = await client.execute({
      sql: "UPDATE Job SET Name = ?, Description = ?, Tier = ? WHERE JobId = ? AND CharacterId = ?",
      args: [Name, Description, Tier, JobId, characterId],
    });

    if (updatedJob.rowsAffected === 0) {
      throw new Error("Failed to update job");
    }

    const result = await client.execute({
      sql: "SELECT * FROM Job WHERE JobId = ?",
      args: [JobId],
    });

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating job:", error);
    return NextResponse.json(
      { error: "Failed to update job", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const characterId = parseInt(params.id);
  const { JobId } = await request.json();

  try {
    const result = await client.execute({
      sql: "DELETE FROM Job WHERE JobId = ? AND CharacterId = ?",
      args: [JobId, characterId],
    });

    if (result.rowsAffected === 0) {
      throw new Error("Failed to delete job");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting job:", error);
    return NextResponse.json(
      { error: "Failed to delete job", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const characterId = parseInt(params.id);
  const { name, description, tier } = await request.json();

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("Database configuration is missing");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const result = await client.execute({
      sql: "INSERT INTO Job (Name, Description, Tier, CharacterId) VALUES (?, ?, ?, ?)",
      args: [name, description, tier, characterId],
    });

    if (!result.lastInsertRowid) {
      throw new Error("Failed to insert new job");
    }

    const newJob = await client.execute({
      sql: "SELECT * FROM Job WHERE JobId = ?",
      args: [result.lastInsertRowid],
    });

    return NextResponse.json(newJob.rows[0]);
  } catch (error) {
    console.error("Error creating job:", error);
    return NextResponse.json(
      { error: "Failed to create job", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
