import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromCookie } from '@/lib/auth'
import { getIO } from '@/lib/socket'
import { getActiveSceneId } from '@/lib/app-settings'

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
    const sceneId = searchParams.get('sceneId')
    
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

    const data = await request.json()
    
    if (!data.id || !data.path || !data.color || !data.sceneId) {
       return NextResponse.json({ error: 'Missing required drawing data fields' }, { status: 400 });
    }
    if (
      typeof data.id !== 'string' || data.id.length > 64 ||
      typeof data.path !== 'string' || data.path.length > 200_000 ||
      typeof data.color !== 'string' || data.color.length > 50
    ) {
      return NextResponse.json({ error: 'Invalid drawing data' }, { status: 400 });
    }
    if (!(await maySeeScene(u, data.sceneId))) {
      return NextResponse.json({ error: 'You can only draw on the active scene' }, { status: 403 });
    }

    const createdBy = u.id
    const createdAt = data.createdAt || new Date().toISOString()
    const payload = { ...data, createdBy, createdAt }

    const info = await db.execute({
      sql: 'INSERT INTO drawing (id, path, color, createdBy, sceneId, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      args: [data.id, data.path, data.color, createdBy, data.sceneId, createdAt],
    });

    if (info.rowsAffected === 0) {
       console.error('Failed to insert drawing, no changes made.');
       return NextResponse.json({ error: 'Failed to create drawing in DB' }, { status: 500 });
    }

    // Emit event to other clients
    try {
      const io = getIO();
      // Ensure data.sceneId is a string for room name
      const sceneRoom = typeof data.sceneId === 'number' ? data.sceneId.toString() : data.sceneId;
      if (sceneRoom) {
        io.to(sceneRoom).emit('drawing_added', payload);
        console.log(`Socket.IO: Emitted drawing_added to room ${sceneRoom}`, payload);
      }
    } catch (socketError) {
      console.error("Socket.IO emit error in POST /drawings:", socketError);
      // Decide if this should affect the HTTP response. For now, it won't.
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
    if (!drawingIdToDelete) {
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
