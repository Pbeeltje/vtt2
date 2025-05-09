import { NextResponse } from 'next/server'
import { db } from '../../lib/db' // better-sqlite3 instance
import { getUserFromCookie } from '../../../lib/auth' // To get current user
import { getIO } from '../../../lib/socket' // Import Socket.IO instance getter

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sceneId = searchParams.get('sceneId')
    
    if (!sceneId) {
      return NextResponse.json({ error: 'Scene ID is required' }, { status: 400 })
    }

    // Use synchronous methods with better-sqlite3
    const stmt = db.prepare('SELECT * FROM drawing WHERE sceneId = ? ORDER BY createdAt ASC');
    const drawings = stmt.all(sceneId); // Pass args directly to all()
    
    return NextResponse.json(drawings);
  } catch (error) {
    console.error('Error fetching drawings:', error)
    return NextResponse.json({ error: 'Failed to fetch drawings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    
    // Validate required fields (basic example)
    if (!data.id || !data.path || !data.color || data.createdBy === undefined || data.createdBy === null || !data.sceneId) {
       return NextResponse.json({ error: 'Missing required drawing data fields' }, { status: 400 });
    }

    // Use synchronous methods with better-sqlite3
    const stmt = db.prepare(
      'INSERT INTO drawing (id, path, color, createdBy, sceneId, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const info = stmt.run(data.id, data.path, data.color, data.createdBy, data.sceneId, data.createdAt || new Date().toISOString());

    // Check if insert was successful
    if (info.changes === 0) {
       console.error('Failed to insert drawing, no changes made.');
       return NextResponse.json({ error: 'Failed to create drawing in DB' }, { status: 500 });
    }

    // Emit event to other clients
    try {
      const io = getIO();
      // Ensure data.sceneId is a string for room name
      const sceneRoom = typeof data.sceneId === 'number' ? data.sceneId.toString() : data.sceneId;
      if (sceneRoom) {
        io.to(sceneRoom).emit('drawing_added', data); // 'data' should be the complete new drawing object
        console.log(`Socket.IO: Emitted drawing_added to room ${sceneRoom}`, data);
      }
    } catch (socketError) {
      console.error("Socket.IO emit error in POST /drawings:", socketError);
      // Decide if this should affect the HTTP response. For now, it won't.
    }
    
    // Return the full drawing object that was created and emitted
    return NextResponse.json(data); // 'data' is the object that was inserted and emitted
  } catch (error) {
    console.error('Error creating drawing:', error);
    // Provide more specific error feedback if possible
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Updated to catch more specific SQLite foreign key error messages
    if (errorMessage.includes('FOREIGN KEY constraint failed') || errorMessage.includes('foreign key mismatch')) {
       console.error('Foreign key constraint failed or mismatch. User ID or Scene ID might not exist or types might conflict.', error);
       return NextResponse.json({ error: 'Failed to create drawing due to invalid reference (User or Scene ID may not exist or types conflict)' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create drawing', details: errorMessage }, { status: 500 });
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
    const drawingStmt = db.prepare('SELECT createdBy, sceneId FROM drawing WHERE id = ?');
    const drawingData = drawingStmt.get(drawingIdToDelete) as { createdBy: number, sceneId: number } | undefined;

    if (!drawingData) {
      return NextResponse.json({ error: 'Drawing not found' }, { status: 404 });
    }

    // Permission check
    if (currentUser.role !== 'DM' && drawingData.createdBy !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to delete this drawing' }, { status: 403 });
    }

    // Proceed with deletion
    const deleteStmt = db.prepare('DELETE FROM drawing WHERE id = ?');
    const info = deleteStmt.run(drawingIdToDelete);

    if (info.changes === 0) {
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
    return NextResponse.json({ error: 'Failed to delete drawing', details: errorMessage }, { status: 500 })
  }
}
