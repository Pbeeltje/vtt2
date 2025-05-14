import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

export async function GET(req: Request, { params }: { params: { sceneId: string } }) {
  const { sceneId } = params;

  try {
    // Get the scene image
    const result = await client.execute({
      sql: "SELECT * FROM DMImage WHERE Id = ? AND Category = 'Scene'",
      args: [sceneId],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching scene:", error);
    return NextResponse.json({ error: "Failed to fetch scene" }, { status: 500 });
  }
} 