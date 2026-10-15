// Player colour, avatar, and who is online right now. Server only.
import type { Server as SocketIOServer } from "socket.io"
import { db } from "./db"
import { PLAYER_COLORS, isPlayerColor } from "./player-colors"
import { AUTHENTICATED_ROOM, type SessionUser } from "./parse-user-cookie"

export interface PlayerProfile {
  id: number
  username: string
  role: string
  color: string
  avatarUrl: string | null
}

// lib/socket.ts's global key, read directly because lib/socket.ts imports this module.
const GLOBAL_IO_KEY = "__vttSocketIOServer"
const getIOIfReady = () => (globalThis as Record<string, unknown>)[GLOBAL_IO_KEY] as SocketIOServer | undefined

/** User ids with at least one connected socket. */
async function onlineUserIds(io: SocketIOServer): Promise<number[]> {
  const sockets = await io.in(AUTHENTICATED_ROOM).fetchSockets()
  const ids = sockets
    .map((s) => (s.data as { user?: SessionUser | null }).user?.id)
    .filter((id): id is number => typeof id === "number")
  return [...new Set(ids)]
}

/**
 * Picks a colour for a new player: one nobody online has, else the one fewest accounts use,
 * at random among ties.
 */
async function pickColor(userId: number): Promise<string> {
  const io = getIOIfReady()
  const online = new Set(io ? (await onlineUserIds(io)).filter((id) => id !== userId) : [])
  const rows = (await db.execute("SELECT UserId, Color FROM user WHERE Color IS NOT NULL")).rows
  const taken = new Set(rows.filter((r) => online.has(Number(r.UserId))).map((r) => String(r.Color)))
  const uses = new Map<string, number>(PLAYER_COLORS.map((c) => [c, 0]))
  for (const r of rows) uses.set(String(r.Color), (uses.get(String(r.Color)) ?? 0) + 1)

  const free = PLAYER_COLORS.filter((c) => !taken.has(c))
  const pool = free.length > 0 ? free : [...PLAYER_COLORS]
  const fewest = Math.min(...pool.map((c) => uses.get(c) ?? 0))
  const candidates = pool.filter((c) => (uses.get(c) ?? 0) === fewest)
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/** The profiles of the given users. Anyone without a valid colour gets one assigned and saved. */
export async function getProfiles(userIds: number[]): Promise<PlayerProfile[]> {
  if (userIds.length === 0) return []
  const result = await db.execute({
    sql: `SELECT UserId, Username, Role, Color, AvatarUrl FROM user WHERE UserId IN (${userIds.map(() => "?").join(",")})`,
    args: userIds,
  })
  const profiles: PlayerProfile[] = []
  for (const row of result.rows) {
    const id = Number(row.UserId)
    let color = row.Color == null ? null : String(row.Color)
    if (!isPlayerColor(color)) {
      color = await pickColor(id)
      await db.execute({ sql: "UPDATE user SET Color = ? WHERE UserId = ?", args: [color, id] })
    }
    profiles.push({
      id,
      username: String(row.Username ?? ""),
      role: String(row.Role ?? "player"),
      color,
      avatarUrl: row.AvatarUrl == null ? null : String(row.AvatarUrl),
    })
  }
  return profiles
}

export async function getProfile(userId: number): Promise<PlayerProfile | null> {
  return (await getProfiles([userId]))[0] ?? null
}

/** Sends everyone the list of players online now, DMs first, then by name. */
export async function broadcastPresence(): Promise<void> {
  const io = getIOIfReady()
  if (!io) return
  try {
    const profiles = await getProfiles(await onlineUserIds(io))
    profiles.sort((a, b) => Number(b.role === "DM") - Number(a.role === "DM") || a.username.localeCompare(b.username))
    io.to(AUTHENTICATED_ROOM).emit("presence", profiles)
  } catch (error) {
    console.error("Presence broadcast failed:", error)
  }
}
