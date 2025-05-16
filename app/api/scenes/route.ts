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

    // Emit socket event for scene update
    try {
      const { getIO } = await import('../../../lib/socket'); // Adjusted path
      const io = getIO();
      // Send the relevant parts of sceneData
      const sceneUpdatePayload = {
        middleLayer: sceneData.elements?.middleLayer || [],
        topLayer: sceneData.elements?.topLayer || [],
        gridSize: sceneData.gridSize,
        gridColor: sceneData.gridColor,
        // Include scale as well if it's part of sceneData and might change
        scale: sceneData.scale 
      };
      io.to(String(sceneId)).emit('scene_updated', sceneId, sceneUpdatePayload);
      console.log(`[API /scenes POST] Emitted 'scene_updated' for scene ${sceneId} with payload:`, sceneUpdatePayload);
    } catch (socketError) {
      console.error("[API /scenes POST] Socket.IO emit error:", socketError);
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    return NextResponse.json({ error: "Failed to save scene" }, { status: 500 });
  }
} 