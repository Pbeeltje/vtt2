// Helpers for broadcasting scene changes over Socket.IO with one consistent payload shape.
import { getIO } from "./socket"

/** The `scene_updated` payload that clients understand (see Home.tsx socket handler). */
export function sceneUpdatePayload(sceneData: any) {
  if (!sceneData) {
    return { middleLayer: [], topLayer: [], gridSize: 50, gridColor: "rgba(0,0,0,0.1)", scale: 1 }
  }
  return {
    middleLayer: sceneData.elements?.middleLayer || [],
    topLayer: sceneData.elements?.topLayer || [],
    gridSize: sceneData.gridSize || 50,
    gridColor: sceneData.gridColor || "rgba(0,0,0,0.1)",
    scale: sceneData.scale || 1,
  }
}

/** Socket id the client sent in the X-Socket-Id header, so it doesn't receive its own echo. */
function senderSocketId(req: Request): string | null {
  const id = req.headers.get("x-socket-id")
  return id && id.length <= 64 ? id : null
}

/** Emit to everyone in the scene room except the socket that made this request. */
export function emitToSceneExceptSender(req: Request, sceneId: number | string, event: string, ...args: unknown[]) {
  const room = getIO().to(String(sceneId))
  const sender = senderSocketId(req)
  ;(sender ? room.except(sender) : room).emit(event, ...args)
}
