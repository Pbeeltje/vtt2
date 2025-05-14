import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "", // No auth token needed for local file
});

export async function GET(req: Request) {
  // Check if we're requesting a specific scene
  const segments = req.url.split('/');
  const lastSegment = segments[segments.length - 1];
  
  // If the last segment is 'scenes', return all scenes
  if (lastSegment === 'scenes') {
    try {
      const result = await client.execute({
        sql: "SELECT * FROM DMImage WHERE Category = 'Scene' AND SceneData IS NOT NULL",
        args: [], // Empty array for no arguments
      });
      return NextResponse.json(result.rows);
    } catch (error) {
      return NextResponse.json({ error: "Failed to fetch scenes" }, { status: 500 });
    }
  }

  // Otherwise, treat the last segment as a scene ID
  const sceneId = lastSegment;
  try {
    const result = await client.execute({
      sql: "SELECT * FROM DMImage WHERE Id = ? AND Category = 'Scene' AND SceneData IS NOT NULL",
      args: [sceneId],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch scene" }, { status: 500 });
  }
} 