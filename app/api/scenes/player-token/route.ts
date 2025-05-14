import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { getUserFromCookie } from '@/lib/auth'; // Assuming auth utilities
import type { LayerImage } from '@/app/types/layerImage'; // Assuming type definition path

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

interface PlayerTokenPayload {
  sceneId: number;
  tokenData: LayerImage;
}

export async function POST(req: Request) {
  console.log("[API /player-token] Received POST request");

  const user = await getUserFromCookie();
  if (!user) {
    console.log("[API /player-token] User not authenticated");
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (user.role !== 'player') {
    console.log("[API /player-token] Non-player attempting to use player-token route");
    return NextResponse.json({ error: 'Forbidden: Only players can place tokens here.' }, { status: 403 });
  }

  let payload: PlayerTokenPayload;
  try {
    payload = await req.json();
    console.log("[API /player-token] Parsed payload:", payload);
  } catch (error) {
    console.error("[API /player-token] Error parsing JSON payload:", error);
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }

  const { sceneId, tokenData } = payload;

  if (!sceneId || !tokenData || !tokenData.id || !tokenData.character?.userId) {
    console.log("[API /player-token] Missing sceneId or tokenData fields");
    return NextResponse.json({ error: 'Missing sceneId or tokenData fields' }, { status: 400 });
  }

  if (tokenData.character.userId !== user.id) {
    console.log(`[API /player-token] Player ${user.id} attempting to place token for character user ${tokenData.character.userId}`);
    return NextResponse.json({ error: 'Forbidden: You can only place your own character tokens.' }, { status: 403 });
  }

  try {
    // Fetch the current scene data from DMImage table
    const sceneResult = await client.execute({
      sql: "SELECT SceneData FROM DMImage WHERE Id = ? AND Category = 'Scene'",
      args: [sceneId],
    });

    if (sceneResult.rows.length === 0) {
      console.log(`[API /player-token] Scene (from DMImage) not found: ${sceneId}`);
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    let sceneData;
    const rawSceneData = sceneResult.rows[0].SceneData as string | null;

    if (rawSceneData) {
      try {
        sceneData = JSON.parse(rawSceneData);
      } catch (e) {
        console.error("[API /player-token] Error parsing SceneData for scene " + sceneId + ":", e);
        return NextResponse.json({ error: 'Failed to parse existing scene data' }, { status: 500 });
      }
    } else {
      // Initialize sceneData if it's null/empty
      sceneData = { elements: { middleLayer: [], topLayer: [] }, gridSize: 50, gridColor: "rgba(0,0,0,0.1)", scale: 1 };
    }
    
    // Ensure elements and topLayer exist
    sceneData.elements = sceneData.elements || { middleLayer: [], topLayer: [] };
    sceneData.elements.topLayer = sceneData.elements.topLayer || [];

    // Add or update the token
    // For simplicity, we'll assume new tokens dropped by players always get added.
    // If a player can move their existing token, this logic would need to find and update.
    // The uniqueId generated in MainContent should prevent direct clashes unless a player
    // drops the exact same character token multiple times resulting in different LayerImage IDs.
    const existingTokenIndex = sceneData.elements.topLayer.findIndex((t: LayerImage) => t.id === tokenData.id);
    if (existingTokenIndex !== -1) {
      // This case should ideally not happen if MainContent always generates a new unique ID for new drops.
      // If it does, it means the player is effectively moving/replacing an existing visual element.
      console.log("[API /player-token] Updating existing token ID " + tokenData.id + " on scene " + sceneId);
      sceneData.elements.topLayer[existingTokenIndex] = tokenData;
    } else {
      console.log("[API /player-token] Adding new token ID " + tokenData.id + " to scene " + sceneId);
      sceneData.elements.topLayer.push(tokenData);
    }
    
    sceneData.savedAt = new Date().toISOString();

    // Save the updated scene data back to DMImage table
    await client.execute({
      sql: "UPDATE DMImage SET SceneData = ? WHERE Id = ? AND Category = 'Scene'",
      args: [JSON.stringify(sceneData), sceneId],
    });

    console.log("[API /player-token] Token for character " + tokenData.characterId + " successfully placed on scene (DMImage) " + sceneId + " by player " + user.id);

    // Emit socket event
    try {
      const { getIO } = await import('../../../../lib/socket'); // Adjust path as needed
      const io = getIO();
      // For other clients to update their view. The payload is the token itself.
      io.to(String(sceneId)).emit('player_token_placed', sceneId, tokenData); 
      console.log("[API /player-token] Emitted 'player_token_placed' for scene " + sceneId);
    } catch (socketError) {
      console.error("[API /player-token] Socket.IO emit error:", socketError);
    }

    return NextResponse.json({ message: 'Token placed successfully', tokenData });
  } catch (error) {
    console.error("[API /player-token] Error processing token placement for scene " + sceneId + ":", error);
    return NextResponse.json({ error: 'Failed to place token', details: error instanceof Error ? error.message : "Unknown server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  console.log("[API /player-token DELETE] Received DELETE request");

  const user = await getUserFromCookie();
  if (!user) {
    console.log("[API /player-token DELETE] User not authenticated");
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (user.role !== 'player') {
    console.log("[API /player-token DELETE] Non-player attempting to delete token");
    return NextResponse.json({ error: 'Forbidden: Only players can delete their tokens here.' }, { status: 403 });
  }

  const url = new URL(req.url);
  const sceneIdStr = url.searchParams.get('sceneId');
  const tokenId = url.searchParams.get('tokenId');

  if (!sceneIdStr || !tokenId) {
    console.log("[API /player-token DELETE] Missing sceneId or tokenId in query params");
    return NextResponse.json({ error: 'Missing sceneId or tokenId' }, { status: 400 });
  }

  const sceneId = parseInt(sceneIdStr, 10);
  if (isNaN(sceneId)) {
    console.log("[API /player-token DELETE] Invalid sceneId format");
    return NextResponse.json({ error: 'Invalid sceneId format' }, { status: 400 });
  }

  try {
    const sceneResult = await client.execute({
      sql: "SELECT SceneData FROM DMImage WHERE Id = ? AND Category = 'Scene'",
      args: [sceneId],
    });

    if (sceneResult.rows.length === 0) {
      console.log(`[API /player-token DELETE] Scene not found: ${sceneId}`);
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    let sceneData;
    const rawSceneData = sceneResult.rows[0].SceneData as string | null;

    if (rawSceneData) {
      try {
        sceneData = JSON.parse(rawSceneData);
      } catch (e) {
        console.error("[API /player-token DELETE] Error parsing SceneData for scene " + sceneId + ":", e);
        return NextResponse.json({ error: 'Failed to parse existing scene data' }, { status: 500 });
      }
    } else {
      console.log(`[API /player-token DELETE] SceneData is empty for scene ${sceneId}. Cannot delete token.`);
      return NextResponse.json({ error: 'Scene data is empty, cannot find token to delete' }, { status: 404 }); 
    }

    sceneData.elements = sceneData.elements || { middleLayer: [], topLayer: [] };
    sceneData.elements.topLayer = sceneData.elements.topLayer || [];

    const initialTokenCount = sceneData.elements.topLayer.length;
    const tokenIndex = sceneData.elements.topLayer.findIndex((t: LayerImage) => t.id === tokenId);

    if (tokenIndex === -1) {
      console.log(`[API /player-token DELETE] Token ID ${tokenId} not found in scene ${sceneId}`);
      return NextResponse.json({ error: 'Token not found in scene' }, { status: 404 });
    }

    const tokenToDelete = sceneData.elements.topLayer[tokenIndex];
    if (tokenToDelete.character?.userId !== user.id) {
      console.log(`[API /player-token DELETE] Player ${user.id} attempting to delete token ${tokenId} owned by user ${tokenToDelete.character?.userId}`);
      return NextResponse.json({ error: 'Forbidden: You can only delete your own character tokens.' }, { status: 403 });
    }

    sceneData.elements.topLayer.splice(tokenIndex, 1);

    if (sceneData.elements.topLayer.length === initialTokenCount) {
        console.warn(`[API /player-token DELETE] Token ${tokenId} was found but not removed from scene ${sceneId}. This indicates an issue.`);
        // This case should ideally not be hit if splice works as expected.
    }

    sceneData.savedAt = new Date().toISOString();

    await client.execute({
      sql: "UPDATE DMImage SET SceneData = ? WHERE Id = ? AND Category = 'Scene'",
      args: [JSON.stringify(sceneData), sceneId],
    });

    console.log(`[API /player-token DELETE] Token ${tokenId} successfully deleted from scene ${sceneId} by player ${user.id}`);

    try {
      const { getIO } = await import('../../../../lib/socket');
      const io = getIO();
      io.to(String(sceneId)).emit('scene_updated', sceneId, { 
        middleLayer: sceneData.elements.middleLayer,
        topLayer: sceneData.elements.topLayer 
      });
      console.log("[API /player-token DELETE] Emitted 'scene_updated' for scene " + sceneId);
    } catch (socketError) {
      console.error("[API /player-token DELETE] Socket.IO emit error:", socketError);
    }

    return NextResponse.json({ message: 'Token deleted successfully' });
  } catch (error) {
    console.error(`[API /player-token DELETE] Error processing token deletion for scene ${sceneId}, token ${tokenId}:`, error);
    return NextResponse.json({ error: 'Failed to delete token', details: error instanceof Error ? error.message : "Unknown server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  console.log("[API /player-token PUT] Received PUT request");

  const user = await getUserFromCookie();
  if (!user) {
    console.log("[API /player-token PUT] User not authenticated");
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (user.role !== 'player') {
    console.log("[API /player-token PUT] Non-player attempting to update token");
    return NextResponse.json({ error: 'Forbidden: Only players can update their tokens here.' }, { status: 403 });
  }

  let payload: PlayerTokenPayload;
  try {
    payload = await req.json();
    console.log("[API /player-token PUT] Parsed payload:", payload);
  } catch (error) {
    console.error("[API /player-token PUT] Error parsing JSON payload:", error);
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }

  const { sceneId, tokenData } = payload;

  if (!sceneId || !tokenData || !tokenData.id || !tokenData.character?.userId) {
    console.log("[API /player-token PUT] Missing sceneId or tokenData fields for update");
    return NextResponse.json({ error: 'Missing sceneId or tokenData fields for update' }, { status: 400 });
  }
  
  // Crucially, the tokenData.id is the ID of the token being updated.
  // tokenData.character.userId is the owner of the character associated with the token.

  try {
    const sceneResult = await client.execute({
      sql: "SELECT SceneData FROM DMImage WHERE Id = ? AND Category = 'Scene'",
      args: [sceneId],
    });

    if (sceneResult.rows.length === 0) {
      console.log(`[API /player-token PUT] Scene not found: ${sceneId}`);
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    let sceneData;
    const rawSceneData = sceneResult.rows[0].SceneData as string | null;

    if (rawSceneData) {
      try {
        sceneData = JSON.parse(rawSceneData);
      } catch (e) {
        console.error("[API /player-token PUT] Error parsing SceneData for scene " + sceneId + ":", e);
        return NextResponse.json({ error: 'Failed to parse existing scene data' }, { status: 500 });
      }
    } else {
      console.log(`[API /player-token PUT] SceneData is empty for scene ${sceneId}. Cannot update token.`);
      return NextResponse.json({ error: 'Scene data is empty, cannot find token to update' }, { status: 404 });
    }

    sceneData.elements = sceneData.elements || { middleLayer: [], topLayer: [] };
    sceneData.elements.topLayer = sceneData.elements.topLayer || [];

    const tokenIndex = sceneData.elements.topLayer.findIndex((t: LayerImage) => t.id === tokenData.id);

    if (tokenIndex === -1) {
      console.log(`[API /player-token PUT] Token ID ${tokenData.id} not found in scene ${sceneId} for update.`);
      // This could happen if the token was deleted by DM just before player update came through.
      return NextResponse.json({ error: 'Token not found in scene to update' }, { status: 404 });
    }

    const existingToken = sceneData.elements.topLayer[tokenIndex];
    if (existingToken.character?.userId !== user.id) {
      console.log(`[API /player-token PUT] Player ${user.id} attempting to update token ${tokenData.id} owned by user ${existingToken.character?.userId}`);
      return NextResponse.json({ error: 'Forbidden: You can only update your own character tokens.' }, { status: 403 });
    }

    // Update the token by replacing it with the new tokenData which contains updated x, y, etc.
    sceneData.elements.topLayer[tokenIndex] = tokenData;
    sceneData.savedAt = new Date().toISOString();

    await client.execute({
      sql: "UPDATE DMImage SET SceneData = ? WHERE Id = ? AND Category = 'Scene'",
      args: [JSON.stringify(sceneData), sceneId],
    });

    console.log(`[API /player-token PUT] Token ${tokenData.id} successfully updated on scene ${sceneId} by player ${user.id}`);

    try {
      const { getIO } = await import('../../../../lib/socket');
      const io = getIO();
      // Emit scene_updated, as the token's position (part of topLayer) has changed.
      io.to(String(sceneId)).emit('scene_updated', sceneId, { 
        middleLayer: sceneData.elements.middleLayer,
        topLayer: sceneData.elements.topLayer 
      });
      console.log("[API /player-token PUT] Emitted 'scene_updated' for scene " + sceneId);
    } catch (socketError) {
      console.error("[API /player-token PUT] Socket.IO emit error:", socketError);
    }

    return NextResponse.json({ message: 'Token updated successfully', tokenData });
  } catch (error) {
    console.error(`[API /player-token PUT] Error processing token update for scene ${sceneId}, token ${tokenData.id}:`, error);
    return NextResponse.json({ error: 'Failed to update token', details: error instanceof Error ? error.message : "Unknown server error" }, { status: 500 });
  }
} 