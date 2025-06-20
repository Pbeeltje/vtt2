import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { requireAuth } from "@/lib/auth";

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "", // No auth token needed for local file
});

export async function GET(req: Request) {
  try {
    // Only DMs can access scenes
    const user = await requireAuth('DM');

    const result = await client.execute({
      sql: "SELECT * FROM DMImage WHERE Category = 'Scene' AND SceneData IS NOT NULL",
      args: [],
    });
    return NextResponse.json(result.rows);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }
      if (error.message === "Insufficient permissions") {
        return NextResponse.json({ error: "Not authorized - DM access required" }, { status: 403 })
      }
    }
    return NextResponse.json({ error: "Failed to fetch scenes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Only DMs can save scenes
    const user = await requireAuth('DM');

    const { sceneId, sceneData } = await req.json();

    // Input validation
    if (!sceneId || typeof sceneId !== 'number') {
      return NextResponse.json({ error: "Scene ID is required and must be a number" }, { status: 400 });
    }

    // Validate sceneData structure if provided
    if (sceneData !== null && typeof sceneData !== 'object') {
      return NextResponse.json({ error: "Scene data must be an object or null" }, { status: 400 });
    }

    // Allow sceneData to be null for clearing scene data
    const sceneDataToStore = sceneData === null ? null : JSON.stringify(sceneData);

    const result = await client.execute({
      sql: "UPDATE DMImage SET SceneData = ? WHERE Id = ? AND Category = 'Scene' RETURNING *",
      args: [sceneDataToStore, sceneId],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Emit socket event for scene update
    try {
      const { getIO } = await import('../../../lib/socket');
      const io = getIO();
      
      if (sceneData === null) {
        // For cleared scene data, emit an empty scene
        const sceneUpdatePayload = {
          middleLayer: [],
          topLayer: [],
          gridSize: 50,
          gridColor: "rgba(0,0,0,0.1)",
          scale: 1
        };
        io.to(String(sceneId)).emit('scene_updated', sceneId, sceneUpdatePayload);
      } else {
        // Send the relevant parts of sceneData for normal updates
        const sceneUpdatePayload = {
          middleLayer: sceneData.elements?.middleLayer || [],
          topLayer: sceneData.elements?.topLayer || [],
          gridSize: sceneData.gridSize || 50,
          gridColor: sceneData.gridColor || "rgba(0,0,0,0.1)",
          scale: sceneData.scale || 1
        };
        io.to(String(sceneId)).emit('scene_updated', sceneId, sceneUpdatePayload);
      }
    } catch (socketError) {
      console.error("[API /scenes POST] Socket.IO emit error:", socketError);
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("[API /scenes POST] Error occurred:", error);
    
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }
      if (error.message === "Insufficient permissions") {
        return NextResponse.json({ error: "Not authorized - DM access required" }, { status: 403 })
      }
    }
    
    return NextResponse.json({ 
      error: "Failed to save scene",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 