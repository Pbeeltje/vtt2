import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getIO, AUTHENTICATED_ROOM } from '@/lib/socket';

/**
 * DM-only: broadcast active scene to all authenticated clients (replaces client-fired dm_set_active_scene).
 */
export async function POST(req: Request) {
  try {
    await requireAuth('DM');
    const body = await req.json();
    const sceneId = body.sceneId;
    if (sceneId === undefined || sceneId === null) {
      return NextResponse.json({ error: 'sceneId is required' }, { status: 400 });
    }
    const id = typeof sceneId === 'number' ? sceneId : parseInt(String(sceneId), 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'sceneId must be a number' }, { status: 400 });
    }

    const io = getIO();
    io.to(AUTHENTICATED_ROOM).emit('force_scene_change', id);
    return NextResponse.json({ ok: true, sceneId: id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      if (error.message === 'Insufficient permissions') {
        return NextResponse.json({ error: 'DM only' }, { status: 403 });
      }
    }
    console.error('[set-active]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
