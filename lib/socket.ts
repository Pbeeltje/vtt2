// lib/socket.ts
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServerNode } from 'http';
import { IncomingMessage, ServerResponse } from 'http';

const GLOBAL_SOCKET_IO_KEY = Symbol('socket.io.server');

interface AppGlobal {
  [GLOBAL_SOCKET_IO_KEY]?: SocketIOServer;
}

const globalNode = globalThis as AppGlobal;

export const initSocketIO = (httpServer: HttpServerNode): SocketIOServer => {
  if (globalNode[GLOBAL_SOCKET_IO_KEY]) {
    return globalNode[GLOBAL_SOCKET_IO_KEY];
  }

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*", // Allows all origins, adjust for production if needed
      methods: ["GET", "POST"]
    }
  });
  
  io.on('connection', (socket) => {
    console.log('Socket.IO: A user connected:', socket.id);

    socket.on('join_scene', (sceneId: string) => {
      socket.join(sceneId);
    });

    socket.on('leave_scene', (sceneId: string) => {
      socket.leave(sceneId);
    });

    socket.on('dm_set_active_scene', (sceneId: string | number) => {
      // Emit to all connected clients, including the sender (DM)
      io.emit('force_scene_change', sceneId);
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO: User disconnected:', socket.id);
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
