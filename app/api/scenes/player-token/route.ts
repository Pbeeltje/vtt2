import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { requireAuth } from '@/lib/auth';
import type { LayerImage } from '@/app/types/layerImage';

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "", // No auth token needed for local file
});

const MAX_TOKEN_JSON_LENGTH = 20_000;

function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof Error) {
    if (error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (error.message === "Insufficient permissions") {
      return NextResponse.json({ error: "Not authorized - Player access required" }, { status: 403 });
    }
  }
  return null;
}

function tokenCharacterId(token: Partial<LayerImage> | undefined): number | null {
  const raw = token?.character?.CharacterId ?? token?.characterId;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Ownership comes from the database, never from the userId inside the token JSON. */
async function characterOwnerId(characterId: number): Promise<number | null> {
  const result = await client.execute({
    sql: "SELECT userId FROM character WHERE CharacterId = ?",
    args: [characterId],
  });
  if (result.rows.length === 0) return null;
  return Number(result.rows[0].userId);
}

async function userOwnsToken(token: Partial<LayerImage> | undefined, userId: number): Promise<boolean> {
  const characterId = tokenCharacterId(token);
  if (characterId === null) return false;
  return (await characterOwnerId(characterId)) === userId;
}

async function loadSceneData(sceneId: unknown) {
  const sceneResult = await client.execute({
    sql: "SELECT SceneData FROM DMImage WHERE Id = ? AND Category = 'Scene'",
    args: [String(sceneId)],
  });
  if (sceneResult.rows.length === 0) return null;
  const raw = sceneResult.rows[0].SceneData;
  return raw ? JSON.parse(String(raw)) : { elements: { topLayer: [] } };
}

async function saveSceneData(sceneId: unknown, sceneData: unknown) {
  await client.execute({
    sql: "UPDATE DMImage SET SceneData = ? WHERE Id = ? AND Category = 'Scene'",
    args: [JSON.stringify(sceneData), String(sceneId)],
  });
}

function withTopLayer(sceneData: any, topLayer: LayerImage[]) {
  return { ...sceneData, elements: { ...sceneData.elements, topLayer } };
}

async function broadcastSceneUpdate(req: Request, sceneId: unknown, sceneData: unknown) {
  try {
    const { emitToSceneExceptSender, sceneUpdatePayload } = await import('../../../../lib/scene-sync');
    emitToSceneExceptSender(req, String(sceneId), 'scene_updated', sceneId, sceneUpdatePayload(sceneData));
  } catch (socketError) {
    console.error("[API /player-token] Socket.IO emit error:", socketError);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth('player');

    const { sceneId, tokenData } = await req.json();
    if (!sceneId || !tokenData || typeof tokenData !== 'object') {
      return NextResponse.json({ error: "Scene ID and token data are required" }, { status: 400 });
    }
    if (
      typeof tokenData.id !== 'string' || tokenData.id.length === 0 || tokenData.id.length > 100 ||
      typeof tokenData.url !== 'string' ||
      !Number.isFinite(tokenData.x) || !Number.isFinite(tokenData.y) ||
      JSON.stringify(tokenData).length > MAX_TOKEN_JSON_LENGTH
    ) {
      return NextResponse.json({ error: "Invalid token data" }, { status: 400 });
    }

    if (!(await userOwnsToken(tokenData, user.id))) {
      return NextResponse.json({ error: "You can only place your own character tokens" }, { status: 403 });
    }

    const currentSceneData = await loadSceneData(sceneId);
    if (!currentSceneData) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    const topLayer: LayerImage[] = currentSceneData.elements?.topLayer || [];
    if (topLayer.some((token) => token.id === tokenData.id)) {
      return NextResponse.json({ error: "A token with this id already exists" }, { status: 409 });
    }

    // Stamp the owner from the database so clients see the real owner.
    const placedToken: LayerImage = tokenData.character
      ? { ...tokenData, character: { ...tokenData.character, userId: user.id } }
      : tokenData;

    await saveSceneData(sceneId, withTopLayer(currentSceneData, [...topLayer, placedToken]));

    try {
      const { emitToSceneExceptSender } = await import('../../../../lib/scene-sync');
      emitToSceneExceptSender(req, String(sceneId), 'player_token_placed', sceneId, placedToken);
    } catch (socketError) {
      console.error("[API /player-token] Socket.IO emit error:", socketError);
    }

    return NextResponse.json({ message: "Token placed successfully", tokenData: placedToken });
  } catch (error) {
    console.error("[API /player-token] Error:", error);
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to place token" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireAuth('player');

    const { searchParams } = new URL(req.url);
    const sceneId = searchParams.get('sceneId');
    const tokenId = searchParams.get('tokenId');
    if (!sceneId || !tokenId) {
      return NextResponse.json({ error: "Scene ID and token ID are required" }, { status: 400 });
    }

    const currentSceneData = await loadSceneData(sceneId);
    if (!currentSceneData) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    const topLayer: LayerImage[] = currentSceneData.elements?.topLayer || [];
    const tokenToDelete = topLayer.find((token) => token.id === tokenId);
    if (!tokenToDelete) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }
    if (!(await userOwnsToken(tokenToDelete, user.id))) {
      return NextResponse.json({ error: "You can only delete your own character tokens" }, { status: 403 });
    }

    const updatedSceneData = withTopLayer(currentSceneData, topLayer.filter((token) => token.id !== tokenId));
    await saveSceneData(sceneId, updatedSceneData);
    await broadcastSceneUpdate(req, sceneId, updatedSceneData);

    return NextResponse.json({ message: "Token deleted successfully" });
  } catch (error) {
    console.error("[API /player-token DELETE] Error:", error);
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to delete token" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireAuth('player');

    const { sceneId, tokenData } = await req.json();
    if (!sceneId || !tokenData || typeof tokenData.id !== 'string') {
      return NextResponse.json({ error: "Scene ID and token data are required" }, { status: 400 });
    }
    if (!Number.isFinite(tokenData.x) || !Number.isFinite(tokenData.y)) {
      return NextResponse.json({ error: "Invalid token position" }, { status: 400 });
    }

    const currentSceneData = await loadSceneData(sceneId);
    if (!currentSceneData) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Check ownership of the token as stored on the server, not the one sent by the client.
    const topLayer: LayerImage[] = currentSceneData.elements?.topLayer || [];
    const storedToken = topLayer.find((token) => token.id === tokenData.id);
    if (!storedToken) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }
    if (!(await userOwnsToken(storedToken, user.id))) {
      return NextResponse.json({ error: "You can only move your own character tokens" }, { status: 403 });
    }

    const updatedSceneData = withTopLayer(
      currentSceneData,
      topLayer.map((token) => (token.id === tokenData.id ? { ...token, x: tokenData.x, y: tokenData.y } : token))
    );
    await saveSceneData(sceneId, updatedSceneData);
    await broadcastSceneUpdate(req, sceneId, updatedSceneData);

    return NextResponse.json({ message: "Token position updated successfully" });
  } catch (error) {
    console.error("[API /player-token PUT] Error:", error);
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to update token position" }, { status: 500 });
  }
}
