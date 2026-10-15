import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PLAYER_COLORS } from "@/lib/player-colors"
import {
  actAs,
  connectClient,
  createScene,
  createUser,
  hostDm,
  jsonRequest,
  settle,
  setupTestDb,
  startSocketServer,
  type TestUser,
} from "./helpers"

let server: Awaited<ReturnType<typeof startSocketServer>>
let alice: TestUser
let bob: TestUser

beforeAll(async () => {
  await setupTestDb()
  server = await startSocketServer()
  alice = await createUser("alice")
  bob = await createUser("bob")
})

afterAll(async () => {
  await server.close()
})

type Presence = Array<{ id: number; username: string; color: string; avatarUrl: string | null }>
const lastPresence = (client: Awaited<ReturnType<typeof connectClient>>) => client.of("presence").at(-1)?.args[0] as Presence

describe("player colour", () => {
  it("is assigned on first sight, kept afterwards, and differs from players online", async () => {
    const a = await connectClient(server.url, alice)
    await settle()
    const b = await connectClient(server.url, bob)
    await settle()

    const { GET } = await import("@/app/api/user/route")
    await actAs(alice)
    const first = await (await GET()).json()
    expect(PLAYER_COLORS).toContain(first.color)
    expect((await (await GET()).json()).color).toBe(first.color)

    const online = lastPresence(a)
    expect(online.map((p) => p.username).sort()).toEqual(["alice", "bob"])
    const colors = online.map((p) => p.color)
    expect(new Set(colors).size).toBe(2)

    a.socket.disconnect()
    b.socket.disconnect()
    await settle()
  })
})

describe("profile", () => {
  it("lets a player change their own colour and avatar, and tells everyone", async () => {
    const watcher = await connectClient(server.url, bob)
    const me = await connectClient(server.url, alice)
    await settle()

    const { PATCH } = await import("@/app/api/user/route")
    await actAs(alice)
    expect((await PATCH(jsonRequest("/api/user", "PATCH", { color: "#123456" }))).status).toBe(400)
    // Only an image alice uploaded herself.
    expect((await PATCH(jsonRequest("/api/user", "PATCH", { avatarUrl: "/uploads/Image/someone-else.png" }))).status).toBe(400)
    expect((await PATCH(jsonRequest("/api/user", "PATCH", { avatarUrl: "https://evil.example/x.png" }))).status).toBe(400)

    const { db } = await import("@/lib/db")
    await db.execute({
      sql: "INSERT INTO DMImage (Name, Link, Category, UserId) VALUES ('me.png', '/uploads/Image/1-me.png', 'Image', ?)",
      args: [alice.id],
    })
    const res = await PATCH(jsonRequest("/api/user", "PATCH", { color: PLAYER_COLORS[4], avatarUrl: "/uploads/Image/1-me.png" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ color: PLAYER_COLORS[4], avatarUrl: "/uploads/Image/1-me.png" })
    await settle()
    expect(lastPresence(watcher).find((p) => p.id === alice.id)).toMatchObject({ color: PLAYER_COLORS[4], avatarUrl: "/uploads/Image/1-me.png" })

    await PATCH(jsonRequest("/api/user", "PATCH", { avatarUrl: null }))
    await settle()
    expect(lastPresence(watcher).find((p) => p.id === alice.id)?.avatarUrl).toBeNull()

    me.socket.disconnect()
    await settle()
    expect(lastPresence(watcher).map((p) => p.id)).toEqual([bob.id])
    watcher.socket.disconnect()
  })
})

describe("map ping", () => {
  it("reaches others on the same scene in the sender's colour, not other scenes or the sender", async () => {
    const sceneId = await createScene("PingMap")
    const other = await createScene("Elsewhere")
    const { setActiveSceneId } = await import("@/lib/app-settings")
    await setActiveSceneId(sceneId)

    const dm = await connectClient(server.url, hostDm)
    const a = await connectClient(server.url, alice)
    const b = await connectClient(server.url, bob)
    dm.socket.emit("join_scene", String(other))
    a.socket.emit("join_scene", String(sceneId))
    b.socket.emit("join_scene", String(sceneId))
    await settle()

    a.socket.emit("map_ping", { sceneId: String(sceneId), x: 120, y: 80 })
    a.socket.emit("map_ping", { sceneId: String(sceneId), x: 1, y: 1 }) // too soon: dropped
    a.socket.emit("map_ping", { sceneId: String(other), x: 5, y: 5 }) // not in that room: dropped
    await settle()

    const { getProfile } = await import("@/lib/player-profile")
    const color = (await getProfile(alice.id))?.color
    expect(b.of("map_ping").map((e) => e.args[0])).toEqual([
      { sceneId, x: 120, y: 80, color, username: "alice", userId: alice.id },
    ])
    expect(a.of("map_ping")).toHaveLength(0)
    expect(dm.of("map_ping")).toHaveLength(0)

    for (const c of [dm, a, b]) c.socket.disconnect()
  })
})

describe("ping limit", () => {
  it("mutes for 10 seconds after 5 pings in 5 seconds", async () => {
    const { newPingLimitState, tryPing } = await import("@/lib/ping-limit")
    const state = newPingLimitState()
    const at = (t: number) => tryPing(state, t)
    expect(at(0)).toEqual({ allowed: true, muted: false })
    expect(at(100).allowed).toBe(false) // too soon after the last
    expect([at(1000), at(2000), at(3000)].every((r) => r.allowed && !r.muted)).toBe(true)
    expect(at(4000)).toEqual({ allowed: true, muted: true }) // the 5th goes through, then mute
    expect(at(9000).allowed).toBe(false)
    expect(at(13_999).allowed).toBe(false)
    expect(at(14_000)).toEqual({ allowed: true, muted: false })
  })

  it("lets slow pinging go on forever", async () => {
    const { newPingLimitState, tryPing } = await import("@/lib/ping-limit")
    const state = newPingLimitState()
    for (let t = 0; t < 60_000; t += 1300) expect(tryPing(state, t)).toEqual({ allowed: true, muted: false })
  })

  it("is enforced by the server", async () => {
    const sceneId = await createScene("SpamMap")
    const { setActiveSceneId } = await import("@/lib/app-settings")
    await setActiveSceneId(sceneId)
    const spammer = await createUser("spammer")
    const s = await connectClient(server.url, spammer)
    const b = await connectClient(server.url, bob)
    s.socket.emit("join_scene", String(sceneId))
    b.socket.emit("join_scene", String(sceneId))
    await settle()
    for (let i = 0; i < 7; i++) {
      s.socket.emit("map_ping", { sceneId: String(sceneId), x: i, y: i })
      await settle(450)
    }
    expect(b.of("map_ping").map((e) => (e.args[0] as { x: number }).x)).toEqual([0, 1, 2, 3, 4])
    for (const c of [s, b]) c.socket.disconnect()
  })
})
