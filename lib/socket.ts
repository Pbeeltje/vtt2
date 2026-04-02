// lib/socket.ts
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServerNode } from 'http';
import {
  parseUserFromCookieHeader,
  AUTHENTICATED_ROOM,
} from './parse-user-cookie';

const GLOBAL_SOCKET_IO_KEY = Symbol('socket.io.server');

interface AppGlobal {
  [GLOBAL_SOCKET_IO_KEY]?: SocketIOServer;
}

const globalNode = globalThis as AppGlobal;

export { AUTHENTICATED_ROOM };

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

  io.use((socket, next) => {
    const user = parseUserFromCookieHeader(socket.handshake.headers.cookie);
    (socket.data as { user?: typeof user }).user = user;
    if (user) {
      void socket.join(AUTHENTICATED_ROOM);
    }
    next();
  });

  io.on('connection', (socket) => {
    const u = (socket.data as { user?: ReturnType<typeof parseUserFromCookieHeader> }).user;
    console.log('Socket.IO: connected:', socket.id, u ? `user=${u.username}` : 'guest');

    socket.on('join_scene', (sceneId: string) => {
      const user = (socket.data as { user?: ReturnType<typeof parseUserFromCookieHeader> }).user;
      if (!user) {
        console.warn('Socket.IO: join_scene ignored (not authenticated)');
        return;
      }
      socket.join(sceneId);
    });

    socket.on('leave_scene', (sceneId: string) => {
      socket.leave(sceneId);
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
