// Test helpers: a fresh temp database per test file, a fake cookie jar for next/headers, and a
// real Socket.IO server so route handlers can be called directly and their events observed.
import fs from "fs"
import os from "os"
import path from "path"
import http from "http"
import type { AddressInfo } from "net"
import { io as ioClient, type Socket } from "socket.io-client"
import { requestContext } from "./setup"

export { requestContext }

/** Points lib/db at a new empty database file and applies all migrations. */
export async function setupTestDb(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vtt-test-"))
  process.env.DATABASE_PATH = path.join(dir, "test.db")
  delete (globalThis as Record<string, unknown>).__vttDbClient
  const { getDb } = await import("@/lib/db")
  const { runMigrations, ensureEnvDmUser } = await import("@/lib/migrate")
  await runMigrations(getDb(), path.resolve(__dirname, "..", "migrations"))
  await ensureEnvDmUser(getDb())
  return process.env.DATABASE_PATH
}

export type TestUser = { id: number; username: string; role: "DM" | "player" }

export async function createUser(username: string, role: "DM" | "player" = "player"): Promise<TestUser> {
  const { db } = await import("@/lib/db")
  const result = await db.execute({
    sql: "INSERT INTO user (Username, Password, Role) VALUES (?, '!', ?) RETURNING UserId",
    args: [username, role],
  })
  return { id: Number(result.rows[0].UserId), username, role }
}

export const hostDm: TestUser = { id: 0, username: "HostDM", role: "DM" }

export async function sessionCookie(user: TestUser): Promise<string> {
  const { createSessionToken } = await import("@/lib/session-token")
  return createSessionToken(user)
}

/** Makes the next route-handler call run as `user` (or logged out with null). */
export async function actAs(user: TestUser | null) {
  requestContext.cookies.clear()
  if (user) requestContext.cookies.set("user", await sessionCookie(user))
}

export function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://test${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function createScene(name = "Map", sceneData: unknown = null): Promise<number> {
  const { db } = await import("@/lib/db")
  const result = await db.execute({
    sql: "INSERT INTO DMImage (Name, Link, Category, UserId, SceneData) VALUES (?, ?, 'Scene', 0, ?) RETURNING Id",
    args: [name, `/uploads/Scene/${name}.png`, sceneData === null ? null : JSON.stringify(sceneData)],
  })
  return Number(result.rows[0].Id)
}

export async function createCharacter(name: string, ownerId: number, category = "Party"): Promise<number> {
  const { db } = await import("@/lib/db")
  const result = await db.execute({
    sql: "INSERT INTO character (Name, userId, category) VALUES (?, ?, ?) RETURNING CharacterId",
    args: [name, ownerId, category],
  })
  return Number(result.rows[0].CharacterId)
}

/** Starts the real Socket.IO server (lib/socket.ts) on a random port. */
export async function startSocketServer(): Promise<{ url: string; close: () => Promise<void> }> {
  delete (globalThis as Record<string, unknown>).__vttSocketIOServer
  const { initSocketIO } = await import("@/lib/socket")
  const server = http.createServer()
  const io = initSocketIO(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      await new Promise<void>((resolve) => io.close(() => resolve()))
      delete (globalThis as Record<string, unknown>).__vttSocketIOServer
    },
  }
}

/** A connected socket.io client, logged in as `user` (or a guest), recording every event. */
export async function connectClient(url: string, user: TestUser | null) {
  const cookie = user ? `user=${await sessionCookie(user)}` : ""
  const socket: Socket = ioClient(url, {
    transports: ["websocket"],
    extraHeaders: cookie ? { cookie } : {},
    forceNew: true,
    reconnection: false,
  })
  const events: Array<{ event: string; args: unknown[] }> = []
  socket.onAny((event, ...args) => events.push({ event, args }))
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve())
    socket.once("connect_error", reject)
  })
  return { socket, events, of: (name: string) => events.filter((e) => e.event === name) }
}

/** Lets in-flight socket messages arrive. */
export const settle = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms))
