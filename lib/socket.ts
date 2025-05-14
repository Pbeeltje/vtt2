// lib/socket.ts
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServerNode } from 'http';

const GLOBAL_SOCKET_IO_KEY = Symbol.for("app.socket.io");

// Define a type for the global object augmented with our custom property
type AppGlobal = typeof globalThis & {
  [GLOBAL_SOCKET_IO_KEY]?: SocketIOServer;
};

const globalNode = globalThis as AppGlobal;

export const initSocketIO = (httpServer: HttpServerNode): SocketIOServer => {
  if (globalNode[GLOBAL_SOCKET_IO_KEY]) {
    console.log("Socket.IO already initialized.");
    return globalNode[GLOBAL_SOCKET_IO_KEY]; // No need for non-null assertion if already checked
  }

  console.log('Socket.IO server initializing on default path /socket.io ...');
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
      console.log(`Socket ${socket.id} joined scene room: ${sceneId}`);
    });

    socket.on('leave_scene', (sceneId: string) => {
      socket.leave(sceneId);
      console.log(`Socket ${socket.id} left scene room: ${sceneId}`);
    });

    socket.on('dm_set_active_scene', (sceneId: string | number) => {
      console.log(`Socket ${socket.id} (DM) initiated 'dm_set_active_scene' for scene ${sceneId}. Broadcasting 'force_scene_change' to all.`);
      // Emit to all connected clients, including the sender (DM)
      io.emit('force_scene_change', sceneId);
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO: User disconnected:', socket.id);
    });
  });

  globalNode[GLOBAL_SOCKET_IO_KEY] = io;
  console.log('Socket.IO server initialized and connection listener attached.');
  return io;
};

export const getIO = (): SocketIOServer => {
  const ioInstance = globalNode[GLOBAL_SOCKET_IO_KEY];
  if (!ioInstance) {
    // This condition should ideally not be met if initSocketIO was called successfully.
    // If it is, it means globalNode[GLOBAL_SOCKET_IO_KEY] = io assignment failed or was cleared.
    throw new Error('Socket.IO not initialized or not found on global! Ensure initSocketIO has been called and completed on server startup.');
  }
  return ioInstance;
};
