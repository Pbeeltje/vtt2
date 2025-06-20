import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { requireAuth } from '@/lib/auth';
import type { LayerImage } from '@/app/types/layerImage'; // Assuming type definition path

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "", // No auth token needed for local file
});

interface PlayerTokenPayload {
  sceneId: number;
  tokenData: LayerImage;
}

export async function POST(req: Request) {
  try {
    // Only players can place tokens
    const user = await requireAuth('player');

    const payload = await req.json();
    const { sceneId, tokenData } = payload;

    if (!sceneId || !tokenData) {
      return NextResponse.json({ error: "Scene ID and token data are required" }, { status: 400 });
    }

    // Validate that the token belongs to the current user
    if (tokenData.character?.userId !== user.id) {
      return NextResponse.json({ error: "You can only place your own character tokens" }, { status: 403 });
    }

    // Get current scene data
    const sceneResult = await client.execute({
      sql: "SELECT SceneData FROM DMImage WHERE Id = ? AND Category = 'Scene'",
      args: [String(sceneId)],
    });

    if (sceneResult.rows.length === 0) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    const currentSceneData = sceneResult.rows[0].SceneData ? JSON.parse(String(sceneResult.rows[0].SceneData)) : { elements: { topLayer: [] } };

    // Add token to top layer
    const updatedTopLayer = [...(currentSceneData.elements?.topLayer || []), tokenData];

    // Update scene data
    const updatedSceneData = {
      ...currentSceneData,
      elements: {
        ...currentSceneData.elements,
        topLayer: updatedTopLayer,
      },
    };

    await client.execute({
      sql: "UPDATE DMImage SET SceneData = ? WHERE Id = ? AND Category = 'Scene'",
      args: [JSON.stringify(updatedSceneData), String(sceneId)],
    });

    // Emit socket event for real-time updates
    try {
      const { getIO } = await import('../../../../lib/socket');
      const io = getIO();
      io.to(String(sceneId)).emit('player_token_placed', sceneId, tokenData);
    } catch (socketError) {
      console.error("[API /player-token] Socket.IO emit error:", socketError);
    }

    return NextResponse.json({ message: "Token placed successfully", tokenData });
  } catch (error) {
    console.error("[API /player-token] Error:", error);
    
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }
      if (error.message === "Insufficient permissions") {
        return NextResponse.json({ error: "Not authorized - Player access required" }, { status: 403 })
      }
    }
    
    return NextResponse.json({ 
      error: "Failed to place token",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    // Only players can delete their own tokens
    const user = await requireAuth('player');

    const { searchParams } = new URL(req.url);
    const sceneId = searchParams.get('sceneId');
    const tokenId = searchParams.get('tokenId');

    if (!sceneId || !tokenId) {
      return NextResponse.json({ error: "Scene ID and token ID are required" }, { status: 400 });
    }

    // Get current scene data
    const sceneResult = await client.execute({
      sql: "SELECT SceneData FROM DMImage WHERE Id = ? AND Category = 'Scene'",
      args: [String(sceneId)],
    });

    if (sceneResult.rows.length === 0) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    const currentSceneData = sceneResult.rows[0].SceneData ? JSON.parse(String(sceneResult.rows[0].SceneData)) : { elements: { topLayer: [] } };

    // Find the token to validate ownership
    const tokenToDelete = (currentSceneData.elements?.topLayer || []).find((token: any) => token.id === tokenId);

    if (!tokenToDelete) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    // Validate that the token belongs to the current user
    if (tokenToDelete.character?.userId !== user.id) {
      return NextResponse.json({ error: "You can only delete your own character tokens" }, { status: 403 });
    }

    // Remove token from top layer
    const updatedTopLayer = (currentSceneData.elements?.topLayer || []).filter((token: any) => token.id !== tokenId);

    // Update scene data
    const updatedSceneData = {
      ...currentSceneData,
      elements: {
        ...currentSceneData.elements,
        topLayer: updatedTopLayer,
      },
    };

    await client.execute({
      sql: "UPDATE DMImage SET SceneData = ? WHERE Id = ? AND Category = 'Scene'",
      args: [JSON.stringify(updatedSceneData), String(sceneId)],
    });

    // Emit socket event for real-time updates
    try {
      const { getIO } = await import('../../../../lib/socket');
      const io = getIO();
      io.to(String(sceneId)).emit('scene_updated', sceneId, updatedSceneData);
    } catch (socketError) {
      console.error("[API /player-token DELETE] Socket.IO emit error:", socketError);
    }

    return NextResponse.json({ message: "Token deleted successfully" });
  } catch (error) {
    console.error("[API /player-token DELETE] Error:", error);
    
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }
      if (error.message === "Insufficient permissions") {
        return NextResponse.json({ error: "Not authorized - Player access required" }, { status: 403 })
      }
    }
    
    return NextResponse.json({ 
      error: "Failed to delete token",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    // Only players can update token positions
    const user = await requireAuth('player');

    const payload = await req.json();
    const { sceneId, tokenData } = payload;

    if (!sceneId || !tokenData) {
      return NextResponse.json({ error: "Scene ID and token data are required" }, { status: 400 });
    }

    // Validate that the token belongs to the current user
    if (tokenData.character?.userId !== user.id) {
      return NextResponse.json({ error: "You can only move your own character tokens" }, { status: 403 });
    }

    // Get current scene data
    const sceneResult = await client.execute({
      sql: "SELECT SceneData FROM DMImage WHERE Id = ? AND Category = 'Scene'",
      args: [String(sceneId)],
    });

    if (sceneResult.rows.length === 0) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    const currentSceneData = sceneResult.rows[0].SceneData ? JSON.parse(String(sceneResult.rows[0].SceneData)) : { elements: { topLayer: [] } };

    // Update token position in top layer
    const updatedTopLayer = (currentSceneData.elements?.topLayer || []).map((token: any) => 
      token.id === tokenData.id ? { ...token, x: tokenData.x, y: tokenData.y } : token
    );

    // Update scene data
    const updatedSceneData = {
      ...currentSceneData,
      elements: {
        ...currentSceneData.elements,
        topLayer: updatedTopLayer,
      },
    };

    await client.execute({
      sql: "UPDATE DMImage SET SceneData = ? WHERE Id = ? AND Category = 'Scene'",
      args: [JSON.stringify(updatedSceneData), String(sceneId)],
    });

    // Emit socket event for real-time updates
    try {
      const { getIO } = await import('../../../../lib/socket');
      const io = getIO();
      io.to(String(sceneId)).emit('scene_updated', sceneId, updatedSceneData);
    } catch (socketError) {
      console.error("[API /player-token PUT] Socket.IO emit error:", socketError);
    }

    return NextResponse.json({ message: "Token position updated successfully" });
  } catch (error) {
    console.error("[API /player-token PUT] Error:", error);
    
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }
      if (error.message === "Insufficient permissions") {
        return NextResponse.json({ error: "Not authorized - Player access required" }, { status: 403 })
      }
    }
    
    return NextResponse.json({ 
      error: "Failed to update token position",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 