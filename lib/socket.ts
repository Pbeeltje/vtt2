// lib/socket.ts
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServerNode } from 'http';
import {
  parseUserFromCookieHeader,
  AUTHENTICATED_ROOM,
  type SessionUser,
} from './parse-user-cookie';
import { db } from './db';
import { getActiveSceneId } from './app-settings';

// Must be a process-wide key (not `Symbol(...)`): API routes are bundled separately from
// server.ts, so each bundle gets its own copy of this module and must still find the server.
const GLOBAL_SOCKET_IO_KEY = '__vttSocketIOServer';

interface AppGlobal {
  [GLOBAL_SOCKET_IO_KEY]?: SocketIOServer;
}

const globalNode = globalThis as AppGlobal;

/** Every DM socket. */
export const DM_ROOM = 'role:dm';
/** Every socket of one user, e.g. for updates to the characters they own. */
export const userRoom = (userId: number) => `user:${userId}`;

export { AUTHENTICATED_ROOM };

/** The session user, with the role re-read from the database like getUserFromCookie does. */
async function resolveUser(cookieHeader: string | undefined): Promise<SessionUser | null> {
  const session = parseUserFromCookieHeader(cookieHeader);
  if (!session) return null;
  try {
    const result = await db.execute({ sql: 'SELECT Role FROM user WHERE UserId = ?', args: [session.id] });
    if (result.rows.length === 0) return null;
    return { ...session, role: String(result.rows[0].Role ?? 'player') };
  } catch (error) {
    console.error('Socket.IO: role lookup failed:', error);
    return null;
  }
}

export const initSocketIO = (httpServer: HttpServerNode): SocketIOServer => {
  if (globalNode[GLOBAL_SOCKET_IO_KEY]) {
    return globalNode[GLOBAL_SOCKET_IO_KEY];
  }

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const user = await resolveUser(socket.handshake.headers.cookie);
    (socket.data as { user?: SessionUser | null }).user = user;
    if (user) {
      void socket.join([AUTHENTICATED_ROOM, userRoom(user.id), ...(user.role === 'DM' ? [DM_ROOM] : [])]);
    }
    next();
  });

  io.on('connection', (socket) => {
    const user = (socket.data as { user?: SessionUser | null }).user;
    console.log('Socket.IO: connected:', socket.id, user ? `user=${user.username}` : 'guest');

    // Scene rooms carry the full map state; players may only follow the active scene.
    socket.on('join_scene', async (sceneId: unknown) => {
      if (!user || typeof sceneId !== 'string' || !/^\d+$/.test(sceneId)) return;
      if (user.role !== 'DM' && (await getActiveSceneId()) !== Number(sceneId)) return;
      for (const room of socket.rooms) {
        if (/^\d+$/.test(room)) void socket.leave(room);
      }
      void socket.join(sceneId);
    });

    socket.on('leave_scene', (sceneId: unknown) => {
      if (typeof sceneId === 'string') void socket.leave(sceneId);
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO: disconnected:', socket.id);
    });
  });

  globalNode[GLOBAL_SOCKET_IO_KEY] = io;
  return io;
};

export const getIO = (): SocketIOServer => {
  const io = globalNode[GLOBAL_SOCKET_IO_KEY];
  if (!io) {
    throw new Error('Socket.IO server not initialized');
  }
  return io;
};
