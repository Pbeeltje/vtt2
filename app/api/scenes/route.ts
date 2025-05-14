import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { getUserFromCookie } from "@/lib/auth";

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "", // No auth token needed for local file
});

export async function GET(req: Request) {
  const user = await getUserFromCookie();
  if (!user || user.role !== "DM") {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const result = await client.execute({
      sql: "SELECT * FROM DMImage WHERE UserId = ? AND Category = 'Scene' AND SceneData IS NOT NULL",
      args: [user.id],
    });
    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch scenes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getUserFromCookie();
  if (!user || user.role !== "DM") {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const { sceneId, sceneData } = await req.json();

    if (!sceneId || !sceneData) {
      return NextResponse.json({ error: "Scene ID and data are required" }, { status: 400 });
    }

    const result = await client.execute({
      sql: "UPDATE DMImage SET SceneData = ? WHERE Id = ? AND UserId = ? AND Category = 'Scene' RETURNING *",
      args: [JSON.stringify(sceneData), sceneId, user.id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    return NextResponse.json({ error: "Failed to save scene" }, { status: 500 });
  }
} 