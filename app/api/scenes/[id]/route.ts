import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db'; // Corrected path for db and direct import
import { getUserFromCookie } from '../../../../lib/auth'; // Corrected auth import
// import { auth } from '../../../../lib/auth'; // Temporarily commenting out problematic auth import

// GET /api/scenes/[id] - Fetches a specific scene by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromCookie(); // Using the confirmed auth pattern
  if (!user) {
    console.log("[API /scenes/[id]] User not authenticated");
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  // console.log("[API /scenes/[id]] User authenticated:", user); // Optional: for debugging

  const sceneId = parseInt(params.id, 10);
  if (isNaN(sceneId)) {
    return NextResponse.json({ error: 'Invalid scene ID' }, { status: 400 });
  }

  // Use 'db' directly from import
  try {
    const stmt = db.prepare(
      "SELECT Id, Name, Link, Category, UserId, SceneData FROM DMImage WHERE Id = ? AND Category = 'Scene'"
    );
    const scene = stmt.get(sceneId);

    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    // Optionally, you might want to check if the user has permission to view this scene,
    // but for a "force_scene_change" scenario, any authenticated user should be able to load it.
    // If SceneData is JSON, parse it before sending, or ensure client handles string.
    // For now, assume client handles SceneData as a string and parses it.

    return NextResponse.json(scene, { status: 200 });
  } catch (error) {
    console.error(`Error fetching scene ${sceneId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch scene' }, { status: 500 });
  }
}

// Keep other methods like PUT if they exist and are needed.
// For example, if you had a PUT for updating scene details (not just SceneData via POST /api/scenes)
// export async function PUT(...) { ... } 