// lib/socket.ts
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServerNode } from 'http';
import {
  sessionTokenFromCookieHeader,
  AUTHENTICATED_ROOM,
  type SessionUser,
} from './parse-user-cookie';
import { resolveSessionUser } from './session-user';
import { isSameOrigin } from './request-guard';
import { getActiveSceneId } from './app-settings';
import { broadcastPresence, getProfile } from './player-profile';
import { newPingLimitState, tryPing, type PingLimitState } from './ping-limit';

/** Per user rather than per socket, so a second tab doesn't double the allowance. */
const pingLimits = new Map<number, PingLimitState>();

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

/** The session user, checked the same way as for HTTP requests (lib/session-user.ts). */
async function resolveUser(cookieHeader: string | undefined): Promise<SessionUser | null> {
  try {
    return await resolveSessionUser(sessionTokenFromCookieHeader(cookieHeader));
  } catch (error) {
    console.error('Socket.IO: session lookup failed:', error);
    return null;
  }
}

export const initSocketIO = (httpServer: HttpServerNode): SocketIOServer => {
  if (globalNode[GLOBAL_SOCKET_IO_KEY]) {
    return globalNode[GLOBAL_SOCKET_IO_KEY];
  }

  const io = new SocketIOServer(httpServer, {
    // The app's own pages only: another site must not open a socket with a player's cookie.
    allowRequest: (req, callback) => callback(null, isSameOrigin(req.headers)),
    // Clients only send tiny events (scene ids, pings).
    maxHttpBufferSize: 16 * 1024,
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

    // Shift+click on the map: everyone else on that scene sees a ring in the sender's colour.
    socket.on('map_ping', async (payload: unknown) => {
      if (!user || !payload || typeof payload !== 'object') return;
      const { sceneId, x, y } = payload as { sceneId?: unknown; x?: unknown; y?: unknown };
      if (typeof sceneId !== 'string' || !socket.rooms.has(sceneId)) return;
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
      let limit = pingLimits.get(user.id);
      if (!limit) pingLimits.set(user.id, (limit = newPingLimitState()));
      if (!tryPing(limit, Date.now()).allowed) return;
      const profile = await getProfile(user.id).catch(() => null);
      if (!profile) return;
      socket.to(sceneId).emit('map_ping', {
        sceneId: Number(sceneId),
        x,
        y,
        color: profile.color,
        username: profile.username,
        userId: profile.id,
      });
    });

    if (user) void broadcastPresence();

    socket.on('disconnect', () => {
      console.log('Socket.IO: disconnected:', socket.id);
      if (user) void broadcastPresence();
    });
  });

  globalNode[GLOBAL_SOCKET_IO_KEY] = io;
  return io;
};

const isSceneRoom = (room: string) => /^\d+$/.test(room);

/**
 * After a role change: move the user's open sockets into or out of the DM room, so a demoted DM
 * stops receiving DM-only events without having to reconnect.
 */
export async function applyRoleToUserSockets(userId: number, role: string): Promise<void> {
  const io = globalNode[GLOBAL_SOCKET_IO_KEY];
  if (!io) return;
  for (const socket of await io.in(userRoom(userId)).fetchSockets()) {
    const user = (socket.data as { user?: SessionUser | null }).user;
    if (user) user.role = role;
    if (role === 'DM') {
      socket.join(DM_ROOM);
    } else {
      socket.leave(DM_ROOM);
      // Players may only follow the active scene.
      const active = await getActiveSceneId();
      for (const room of socket.rooms) if (isSceneRoom(room) && Number(room) !== active) socket.leave(room);
    }
  }
}

/** Closes every open socket of a user, e.g. after their password was reset. */
export function disconnectUserSockets(userId: number): void {
  globalNode[GLOBAL_SOCKET_IO_KEY]?.in(userRoom(userId)).disconnectSockets(true);
}

/** Players' sockets leave every scene room except the active one (after the DM switched scenes). */
export function removePlayersFromInactiveScenes(activeSceneId: number): void {
  const io = globalNode[GLOBAL_SOCKET_IO_KEY];
  if (!io) return;
  for (const room of io.of('/').adapter.rooms.keys()) {
    if (isSceneRoom(room) && Number(room) !== activeSceneId) io.in(room).except(DM_ROOM).socketsLeave(room);
  }
}

export const getIO = (): SocketIOServer => {
  const io = globalNode[GLOBAL_SOCKET_IO_KEY];
  if (!io) {
    throw new Error('Socket.IO server not initialized');
  }
  return io;
};
