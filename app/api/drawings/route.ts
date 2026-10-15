import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromCookie } from '@/lib/auth'
import { getIO } from '@/lib/socket'
import { getActiveSceneId } from '@/lib/app-settings'
import { parseId } from '@/lib/api-errors'
import { rateLimit } from '@/lib/rate-limit'

/** SVG path data only: commands, numbers, separators. */
const SVG_PATH = /^[MLHVCSQTAZmlhvcsqtaz0-9eE.,\s+-]+$/
/** Hex or rgb()/rgba(); nothing that could reference a URL. */
const DRAWING_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i

/** Players only see and draw on the active scene; DMs on any scene. */
async function maySeeScene(user: { role: string }, sceneId: unknown): Promise<boolean> {
  return user.role === 'DM' || (await getActiveSceneId()) === Number(sceneId)
}

export async function GET(request: Request) {
  try {
    const u = await getUserFromCookie()
    if (!u) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sceneId = parseId(searchParams.get('sceneId'))

    if (!sceneId) {
      return NextResponse.json({ error: 'Scene ID is required' }, { status: 400 })
    }
    if (!(await maySeeScene(u, sceneId))) {
      return NextResponse.json([])
    }

    const result = await db.execute({
      sql: 'SELECT id, path, color, createdBy, sceneId, createdAt FROM drawing WHERE sceneId = ? ORDER BY createdAt ASC',
      args: [sceneId],
    })
    return NextResponse.json(result.rows.map((row) => ({ ...row })));
  } catch (error) {
    console.error('Error fetching drawings:', error)
    return NextResponse.json({ error: 'Failed to fetch drawings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const u = await getUserFromCookie()
    if (!u) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!rateLimit(`drawing:user:${u.id}`, 120, 60 * 1000)) {
      return NextResponse.json({ error: 'Drawing too fast; slow down a little' }, { status: 429 })
    }

    const data = await request.json().catch(() => null)
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Invalid drawing data' }, { status: 400 })
    }
    const sceneId = parseId(data.sceneId)
    if (
      !sceneId ||
      typeof data.id !== 'string' || !/^[\w-]{1,64}$/.test(data.id) ||
      typeof data.path !== 'string' || data.path.length === 0 || data.path.length > 200_000 || !SVG_PATH.test(data.path) ||
      typeof data.color !== 'string' || !DRAWING_COLOR.test(data.color)
    ) {
      return NextResponse.json({ error: 'Invalid drawing data' }, { status: 400 });
    }
    if (!(await maySeeScene(u, sceneId))) {
      return NextResponse.json({ error: 'You can only draw on the active scene' }, { status: 403 });
    }

    // Only the stored fields go back out; the server sets who and when.
    const payload = { id: data.id, path: data.path, color: data.color, createdBy: u.id, sceneId, createdAt: new Date().toISOString() }

    const info = await db.execute({
      sql: 'INSERT INTO drawing (id, path, color, createdBy, sceneId, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      args: [payload.id, payload.path, payload.color, payload.createdBy, payload.sceneId, payload.createdAt],
    });

    if (info.rowsAffected === 0) {
       console.error('Failed to insert drawing, no changes made.');
       return NextResponse.json({ error: 'Failed to create drawing in DB' }, { status: 500 });
    }

    // Emit event to other clients
    try {
      getIO().to(String(sceneId)).emit('drawing_added', payload);
    } catch (socketError) {
      console.error("Socket.IO emit error in POST /drawings:", socketError);
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error creating drawing:', error);
    // Provide more specific error feedback if possible
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Updated to catch more specific SQLite foreign key error messages
    if (errorMessage.includes('FOREIGN KEY constraint failed') || errorMessage.includes('foreign key mismatch')) {
       console.error('Foreign key constraint failed or mismatch. User ID or Scene ID might not exist or types might conflict.', error);
       return NextResponse.json({ error: 'Failed to create drawing due to invalid reference (User or Scene ID may not exist or types conflict)' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create drawing' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await getUserFromCookie();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url)
    const drawingIdToDelete = searchParams.get('id')
    if (!drawingIdToDelete || drawingIdToDelete.length > 64) {
      return NextResponse.json({ error: 'Drawing ID is required' }, { status: 400 })
    }

    // Fetch the drawing to check its creator and get sceneId for socket emit
    const found = await db.execute({ sql: 'SELECT createdBy, sceneId FROM drawing WHERE id = ?', args: [drawingIdToDelete] });
    const drawingData = found.rows[0]
      ? { createdBy: Number(found.rows[0].createdBy), sceneId: Number(found.rows[0].sceneId) }
      : undefined;

    if (!drawingData) {
      return NextResponse.json({ error: 'Drawing not found' }, { status: 404 });
    }

    // Permission check
    if (currentUser.role !== 'DM' && drawingData.createdBy !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to delete this drawing' }, { status: 403 });
    }

    // Proceed with deletion
    const info = await db.execute({ sql: 'DELETE FROM drawing WHERE id = ?', args: [drawingIdToDelete] });

    if (info.rowsAffected === 0) {
      return NextResponse.json({ error: 'Drawing not found or already deleted (race condition)' }, { status: 404 });
    }

    // Emit event to other clients
    try {
      const io = getIO();
      const sceneRoom = drawingData.sceneId.toString();
      io.to(sceneRoom).emit('drawing_removed', drawingIdToDelete, drawingData.sceneId);
      console.log(`Socket.IO: Emitted drawing_removed to room ${sceneRoom}`, drawingIdToDelete);
    } catch (socketError) {
      console.error("Socket.IO emit error in DELETE /drawings:", socketError);
    }

    return NextResponse.json({ success: true, message: "Drawing deleted successfully" });
  } catch (error) {
    console.error('Error deleting drawing:', error)
    // Keep the existing detailed error handling for foreign key issues or other DB errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('FOREIGN KEY constraint failed') || errorMessage.includes('foreign key mismatch')) {
       console.error('Foreign key constraint failed or mismatch during delete (should not happen if DB is consistent).', error);
       return NextResponse.json({ error: 'Database consistency error during delete' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to delete drawing' }, { status: 500 })
  }
}
