import bcrypt from "bcryptjs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { io as ioClient } from "socket.io-client"
import {
  actAs,
  connectClient,
  createCharacter,
  createScene,
  createUser,
  hostDm,
  jsonRequest,
  requestContext,
  sessionCookie,
  settle,
  setupTestDb,
  startSocketServer,
  type TestUser,
} from "./helpers"
import { checkApiRequest, isSameOrigin, sanitizeForwardedHeaders } from "@/lib/request-guard"

let server: Awaited<ReturnType<typeof startSocketServer>>
let alice: TestUser
let bob: TestUser
let aliceHero: number

const params = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) })

beforeAll(async () => {
  await setupTestDb()
  server = await startSocketServer()
  alice = await createUser("alice")
  bob = await createUser("bob")
  aliceHero = await createCharacter("Aria", alice.id)
})

afterAll(async () => {
  await server.close()
})

describe("request guard", () => {
  it("lets same-origin and Origin-less writes through, and blocks other sites", () => {
    expect(isSameOrigin({ host: "vtt.local:3000" })).toBe(true)
    expect(isSameOrigin({ host: "vtt.local:3000", origin: "http://vtt.local:3000" })).toBe(true)
    expect(isSameOrigin({ host: "127.0.0.1:3000", "x-forwarded-host": "abc.trycloudflare.com", origin: "https://abc.trycloudflare.com" })).toBe(true)
    expect(isSameOrigin({ host: "vtt.local:3000", origin: "https://evil.trycloudflare.com" })).toBe(false)
    expect(isSameOrigin({ host: "vtt.local:3000", origin: "http://vtt.local:4000" })).toBe(false)
    expect(isSameOrigin({ host: "vtt.local:3000", origin: "null" })).toBe(false)
    expect(isSameOrigin({ host: "vtt.local:3000", "sec-fetch-site": "cross-site" })).toBe(false)
  })

  it("only checks API writes", () => {
    const evil = { host: "vtt.local", origin: "https://evil.example" }
    expect(checkApiRequest("GET", "/api/chat", evil)).toBeNull()
    expect(checkApiRequest("POST", "/", evil)).toBeNull() // server actions: Next checks those itself
    expect(checkApiRequest("POST", "/api/chat", evil)?.status).toBe(403)
    expect(checkApiRequest("DELETE", "/api/notes", evil)?.status).toBe(403)
  })

  it("caps body sizes before they are read", () => {
    const h = (len: number) => ({ host: "vtt.local", "content-length": String(len) })
    expect(checkApiRequest("POST", "/api/chat", h(1000))).toBeNull()
    expect(checkApiRequest("POST", "/api/chat", h(2 * 1024 * 1024))?.status).toBe(413)
    expect(checkApiRequest("POST", "/api/images", h(5 * 1024 * 1024))).toBeNull()
    expect(checkApiRequest("POST", "/api/images", h(9 * 1024 * 1024))?.status).toBe(413)
    expect(checkApiRequest("POST", "/api/chat", { host: "vtt.local", "transfer-encoding": "chunked" })?.status).toBe(411)
  })

  it("ignores forwarded IP headers unless they come from this machine", () => {
    const fromLan: Record<string, string> = { "x-forwarded-for": "1.2.3.4", "cf-connecting-ip": "1.2.3.4", "x-forwarded-host": "evil" }
    sanitizeForwardedHeaders(fromLan, "192.168.1.20")
    expect(fromLan).toEqual({ "x-forwarded-for": "192.168.1.20" })

    const fromTunnel: Record<string, string> = { "cf-connecting-ip": "1.2.3.4" }
    sanitizeForwardedHeaders(fromTunnel, "::ffff:127.0.0.1")
    expect(fromTunnel).toEqual({ "cf-connecting-ip": "1.2.3.4" })
  })
})

describe("sessions end when the password changes", () => {
  it("rejects a cookie minted before a password reset", async () => {
    const carol = await createUser("carol")
    const { getUserFromCookie } = await import("@/lib/auth")
    const oldCookie = await sessionCookie(carol)
    requestContext.cookies.set("user", oldCookie)
    expect(await getUserFromCookie()).toMatchObject({ id: carol.id })

    await actAs(hostDm)
    const { PUT } = await import("@/app/api/users/[id]/password/route")
    const res = await PUT(jsonRequest(`/api/users/${carol.id}/password`, "PUT", { newPassword: "a-brand-new-password" }), params(carol.id))
    expect(res.status).toBe(200)

    requestContext.cookies.set("user", oldCookie)
    expect(await getUserFromCookie()).toBeNull()
  })

  it("logs in with the new password and gets a working session", async () => {
    const { db } = await import("@/lib/db")
    await db.execute({ sql: "UPDATE user SET Password = ? WHERE UserId = ?", args: [await bcrypt.hash("dave password", 4), bob.id] })
    requestContext.cookies.clear()
    const { authenticateAndSetCookie, getUserFromCookie } = await import("@/lib/auth")
    expect(await authenticateAndSetCookie("BOB", "dave password")).toMatchObject({ success: true })
    expect(await getUserFromCookie()).toMatchObject({ id: bob.id })
  })

  it("refuses the socket of a session whose password changed", async () => {
    const erin = await createUser("erin")
    const cookie = await sessionCookie(erin)
    const { db } = await import("@/lib/db")
    await db.execute({ sql: "UPDATE user SET Password = 'changed' WHERE UserId = ?", args: [erin.id] })
    const socket = ioClient(server.url, { transports: ["websocket"], extraHeaders: { cookie: `user=${cookie}` }, forceNew: true, reconnection: false })
    await new Promise<void>((resolve) => socket.once("connect", () => resolve()))
    const { getIO, AUTHENTICATED_ROOM } = await import("@/lib/socket")
    const ids = (await getIO().in(AUTHENTICATED_ROOM).fetchSockets()).map((s) => s.id)
    expect(ids).not.toContain(socket.id) // connected as a guest
    socket.close()
  })
})

describe("sockets", () => {
  it("refuses a handshake from another site", async () => {
    const socket = ioClient(server.url, {
      transports: ["websocket"],
      extraHeaders: { origin: "https://evil.example", cookie: `user=${await sessionCookie(alice)}` },
      forceNew: true,
      reconnection: false,
    })
    const outcome = await new Promise<string>((resolve) => {
      socket.once("connect", () => resolve("connected"))
      socket.once("connect_error", () => resolve("refused"))
    })
    expect(outcome).toBe("refused")
    socket.close()
  })

  it("takes a demoted DM out of the DM room at once", async () => {
    const frank = await createUser("frank", "DM")
    const client = await connectClient(server.url, frank)
    const { getIO, DM_ROOM } = await import("@/lib/socket")
    const inDmRoom = async () => (await getIO().in(DM_ROOM).fetchSockets()).some((s) => s.id === client.socket.id)
    expect(await inDmRoom()).toBe(true)

    await actAs(hostDm)
    const { PATCH } = await import("@/app/api/users/[id]/role/route")
    expect((await PATCH(jsonRequest(`/api/users/${frank.id}/role`, "PATCH", { role: "player" }), params(frank.id))).status).toBe(200)
    expect(await inDmRoom()).toBe(false)
    client.socket.close()
  })

  it("drops players from the old scene room when the DM switches scenes", async () => {
    const first = await createScene("First", { gridSize: 50 })
    const second = await createScene("Second", { gridSize: 50 })
    await actAs(hostDm)
    const { POST } = await import("@/app/api/scenes/set-active/route")
    await POST(jsonRequest("/api/scenes/set-active", "POST", { sceneId: first }))

    const player = await connectClient(server.url, alice)
    const dm = await connectClient(server.url, hostDm)
    player.socket.emit("join_scene", String(first))
    dm.socket.emit("join_scene", String(first))
    await settle()

    await actAs(hostDm)
    await POST(jsonRequest("/api/scenes/set-active", "POST", { sceneId: second }))
    const { getIO } = await import("@/lib/socket")
    const inFirst = (await getIO().in(String(first)).fetchSockets()).map((s) => s.id)
    expect(inFirst).toContain(dm.socket.id)
    expect(inFirst).not.toContain(player.socket.id)
    player.socket.close()
    dm.socket.close()
  })
})

describe("player tokens are built by the server", () => {
  it("ignores the image, stats and size the client sent", async () => {
    const scene = await createScene("Tokens", { gridSize: 50 })
    await actAs(hostDm)
    const { POST: setActive } = await import("@/app/api/scenes/set-active/route")
    await setActive(jsonRequest("/api/scenes/set-active", "POST", { sceneId: scene }))

    await actAs(alice)
    const { POST } = await import("@/app/api/scenes/player-token/route")
    const res = await POST(jsonRequest("/api/scenes/player-token", "POST", {
      sceneId: scene,
      tokenData: {
        id: `${aliceHero}-1`, x: 100, y: 50, characterId: aliceHero,
        url: "https://tracker.example/pixel.png", width: 99999, evil: "<script>",
        character: { CharacterId: aliceHero, Name: "Aria", Guard: 999, MaxGuard: 999 },
      },
    }))
    expect(res.status).toBe(200)
    const { state } = await res.json()
    const token = state.elements.topLayer.find((t: { id: string }) => t.id === `${aliceHero}-1`)
    expect(token).toMatchObject({ x: 100, y: 50, width: 50, height: 50, url: "/placeholder.svg", characterId: aliceHero })
    expect(token.character.Guard).not.toBe(999)
    expect(token).not.toHaveProperty("evil")
  })
})

describe("input validation", () => {
  it("only accepts same-site or https image URLs on characters", async () => {
    await actAs(alice)
    const { PUT } = await import("@/app/api/characters/[id]/route")
    const put = (TokenUrl: string) => PUT(jsonRequest(`/api/characters/${aliceHero}`, "PUT", { TokenUrl }), params(aliceHero))
    expect((await put("/uploads/Image/1-a.png")).status).toBe(200)
    expect((await put("https://i.imgur.com/abc.png")).status).toBe(200)
    for (const bad of ["javascript:alert(1)", "http://x.example/a.png", "//evil.example/a.png", '/a.png")', "/\\evil.example", "data:image/png;base64,AA"]) {
      expect((await put(bad)).status, bad).toBe(400)
    }
  })

  it("stores and broadcasts only the drawing fields, with checked colour and path", async () => {
    const scene = await createScene("Drawn", { gridSize: 50 })
    await actAs(hostDm)
    const { POST } = await import("@/app/api/drawings/route")
    const good = { id: "d-1", path: "M1,2 L3,4", color: "#e5484d", sceneId: scene }
    const res = await POST(jsonRequest("/api/drawings", "POST", { ...good, createdBy: 42, createdAt: "1999", extra: "x" }))
    expect(res.status).toBe(200)
    const saved = await res.json()
    expect(Object.keys(saved).sort()).toEqual(["color", "createdAt", "createdBy", "id", "path", "sceneId"])
    expect(saved.createdBy).toBe(0)
    expect(saved.createdAt).not.toBe("1999")

    for (const bad of [{ color: "url(https://evil.example/x)" }, { path: "M1,2 <script>" }, { id: "../x" }, { sceneId: "abc" }]) {
      expect((await POST(jsonRequest("/api/drawings", "POST", { ...good, id: "d-2", ...bad }))).status).toBe(400)
    }
  })

  it("only registers usernames made of letters, digits, _ . and -", async () => {
    const { POST } = await import("@/app/api/register/route")
    const register = (username: string) => POST(jsonRequest("/api/register", "POST", { username, password: "long enough pw" }))
    expect((await register("new.player_1")).status).toBe(200)
    expect((await register("bad name")).status).toBe(400)
    expect((await register("evil‮eman")).status).toBe(400)
  })

  it("lets only the host control the tunnel", async () => {
    const delegated = await createUser("grace", "DM")
    await actAs(delegated)
    const { GET } = await import("@/app/api/tunnel/route")
    expect((await GET()).status).toBe(403)
    await actAs(hostDm)
    expect((await GET()).status).toBe(200)
  })
})
