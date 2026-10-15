import bcrypt from "bcryptjs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  actAs,
  connectClient,
  createCharacter,
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

let server: Awaited<ReturnType<typeof startSocketServer>>
let alice: TestUser
let bob: TestUser

beforeAll(async () => {
  await setupTestDb()
  server = await startSocketServer()
  alice = await createUser("alice")
  bob = await createUser("bob")
  await createCharacter("Aria", alice.id)
  const { db } = await import("@/lib/db")
  await db.execute({ sql: "UPDATE user SET Password = ? WHERE UserId = ?", args: [await bcrypt.hash("correct horse", 4), alice.id] })
})

afterAll(async () => {
  await server.close()
})

describe("sessions", () => {
  it("rejects a forged or tampered cookie", async () => {
    const { getUserFromCookie } = await import("@/lib/auth")
    const token = await sessionCookie(alice)
    const [payload, sig] = token.split(".")
    const forgedPayload = Buffer.from(JSON.stringify({ ...alice, role: "DM", exp: Date.now() + 1e6 })).toString("base64url")

    requestContext.cookies.set("user", `${forgedPayload}.${sig}`)
    expect(await getUserFromCookie()).toBeNull()
    requestContext.cookies.set("user", `${payload}.${sig.slice(0, -2)}xx`)
    expect(await getUserFromCookie()).toBeNull()
    requestContext.cookies.set("user", token)
    expect(await getUserFromCookie()).toMatchObject({ id: alice.id, role: "player" })
  })

  it("re-reads the role from the database", async () => {
    const { getUserFromCookie } = await import("@/lib/auth")
    await actAs({ ...alice, role: "DM" }) // a cookie minted while alice was a DM
    expect((await getUserFromCookie())?.role).toBe("player")
  })

  it("resolves the env DM to the host row", async () => {
    const { getUserFromCookie } = await import("@/lib/auth")
    await actAs(hostDm)
    expect(await getUserFromCookie()).toMatchObject({ id: 0, role: "DM" })
  })
})

describe("login", () => {
  it("accepts the env DM and database users (case-insensitive name)", async () => {
    const { authenticateAndSetCookie } = await import("@/lib/auth")
    requestContext.headers = new Headers({ "x-forwarded-for": "10.0.0.1" })
    expect(await authenticateAndSetCookie("HostDM", "host-dm-password")).toMatchObject({ success: true, role: "DM" })
    expect(await authenticateAndSetCookie("ALICE", "correct horse")).toMatchObject({ success: true, username: "alice" })
    expect(await authenticateAndSetCookie("alice", "wrong")).toMatchObject({ success: false })
  })

  it("cannot log in as user 0 with its stored (unusable) password", async () => {
    const { authenticateAndSetCookie } = await import("@/lib/auth")
    requestContext.headers = new Headers({ "x-forwarded-for": "10.0.0.2" })
    expect(await authenticateAndSetCookie("HostDM", "!")).toMatchObject({ success: false })
  })

  it("rate-limits repeated attempts on one account", async () => {
    const { authenticateAndSetCookie } = await import("@/lib/auth")
    requestContext.headers = new Headers({ "x-forwarded-for": "10.0.0.3" })
    const results = []
    for (let i = 0; i < 12; i++) results.push(await authenticateAndSetCookie("bob", "nope"))
    expect(results.at(-1)?.error).toMatch(/Too many/)
  })
})

describe("register", () => {
  it("refuses names that differ only in case, or the env DM's name", async () => {
    const { POST } = await import("@/app/api/register/route")
    const res1 = await POST(jsonRequest("/api/register", "POST", { username: "ALICE", password: "longenough" }))
    expect(res1.status).toBe(409)
    const res2 = await POST(jsonRequest("/api/register", "POST", { username: "hostdm", password: "longenough" }))
    expect(res2.status).toBe(409)
    const res3 = await POST(jsonRequest("/api/register", "POST", { username: "carol", password: "longenough" }))
    expect(res3.status).toBe(200)
  })
})

describe("chat", () => {
  async function post(user: TestUser, body: Record<string, unknown>) {
    await actAs(user)
    const { POST } = await import("@/app/api/chat/route")
    return POST(jsonRequest("/api/chat", "POST", { type: "user", content: "hi", ...body }))
  }

  it("lets players speak as themselves or their own characters only", async () => {
    expect((await post(alice, { speakerName: "alice", senderType: "user" })).status).toBe(200)
    expect((await post(alice, { speakerName: "Aria", senderType: "character" })).status).toBe(200)
    expect((await post(bob, { speakerName: "Aria", senderType: "character" })).status).toBe(403)
    expect((await post(bob, { speakerName: "alice", senderType: "user" })).status).toBe(403)
    expect((await post(hostDm, { speakerName: "The Innkeeper", senderType: "character" })).status).toBe(200)
  })

  it("refuses client-made dice messages", async () => {
    expect((await post(alice, { type: "diceRoll", content: "rolled a 20!" })).status).toBe(400)
  })

  it("delivers messages live to logged-in sockets only", async () => {
    const player = await connectClient(server.url, bob)
    const guest = await connectClient(server.url, null)
    await post(alice, { content: "live!" })
    await settle()
    expect(player.of("new_message").map((e) => (e.args[0] as { Content: string }).Content)).toEqual(["live!"])
    expect(guest.of("new_message")).toHaveLength(0)
    player.socket.disconnect()
    guest.socket.disconnect()
  })

  it("pages through history", async () => {
    await actAs(alice)
    const { GET } = await import("@/app/api/chat/route")
    const latest = await (await GET(jsonRequest("/api/chat?limit=2", "GET"))).json()
    expect(latest).toHaveLength(2)
    expect(latest[0].MessageId).toBeLessThan(latest[1].MessageId)
    const older = await (await GET(jsonRequest(`/api/chat?limit=2&before=${latest[0].MessageId}`, "GET"))).json()
    expect(older.every((m: { MessageId: number }) => m.MessageId < latest[0].MessageId)).toBe(true)
  })
})

describe("POST /api/roll", () => {
  it("rolls on the server and stores the dice with the message", async () => {
    await actAs(alice)
    const { POST } = await import("@/app/api/roll/route")
    const res = await POST(jsonRequest("/api/roll", "POST", { expression: "2d8kh1", label: "Attack", speakerName: "Aria", senderType: "character" }))
    expect(res.status).toBe(200)
    const row = await res.json()
    expect(row).toMatchObject({ Type: "diceRoll", Username: "Aria", SenderType: "character" })
    const data = JSON.parse(row.Data)
    expect(data.terms[0].rolls).toHaveLength(2)
    expect(data.total).toBe(Math.max(...data.terms[0].rolls))
    expect(row.Content).toMatch(/^Attack: rolled 2d8kh1 \[/)
  })

  it("rejects bad expressions and other players' characters", async () => {
    const { POST } = await import("@/app/api/roll/route")
    await actAs(alice)
    expect((await POST(jsonRequest("/api/roll", "POST", { expression: "1000d6" }))).status).toBe(400)
    await actAs(bob)
    expect((await POST(jsonRequest("/api/roll", "POST", { expression: "d20", speakerName: "Aria", senderType: "character" }))).status).toBe(403)
  })
})

describe("POST /api/roll/test", () => {
  it("rolls a d20 against the stored score as the character", async () => {
    const { db } = await import("@/lib/db")
    await db.execute({ sql: "UPDATE character SET Mind = 12 WHERE Name = 'Aria'", args: [] })
    const id = Number((await db.execute({ sql: "SELECT CharacterId FROM character WHERE Name = 'Aria'", args: [] })).rows[0].CharacterId)
    await actAs(alice)
    const { POST } = await import("@/app/api/roll/test/route")
    const res = await POST(jsonRequest("/api/roll/test", "POST", { characterId: id, attribute: "Mind" }))
    expect(res.status).toBe(200)
    const row = await res.json()
    expect(row).toMatchObject({ Type: "diceRoll", Username: "Aria", SenderType: "character" })
    const data = JSON.parse(row.Data)
    expect(data.test).toMatchObject({ attribute: "Mind", score: 12, roll: data.total })
    expect(row.Content).toMatch(/^Mind test vs 12: \d+ (pass|fail)$/)
  })

  it("rejects other players' characters, unknown attributes and unknown characters", async () => {
    const { db } = await import("@/lib/db")
    const id = Number((await db.execute({ sql: "SELECT CharacterId FROM character WHERE Name = 'Aria'", args: [] })).rows[0].CharacterId)
    const { POST } = await import("@/app/api/roll/test/route")
    await actAs(bob)
    expect((await POST(jsonRequest("/api/roll/test", "POST", { characterId: id, attribute: "Mind" }))).status).toBe(403)
    await actAs(alice)
    expect((await POST(jsonRequest("/api/roll/test", "POST", { characterId: id, attribute: "Name" }))).status).toBe(400)
    expect((await POST(jsonRequest("/api/roll/test", "POST", { characterId: 99999, attribute: "Mind" }))).status).toBe(404)
  })

  it("lets the DM roll for any character", async () => {
    const { db } = await import("@/lib/db")
    const id = Number((await db.execute({ sql: "SELECT CharacterId FROM character WHERE Name = 'Aria'", args: [] })).rows[0].CharacterId)
    await actAs(hostDm)
    const { POST } = await import("@/app/api/roll/test/route")
    expect((await POST(jsonRequest("/api/roll/test", "POST", { characterId: id, attribute: "Mind" }))).status).toBe(200)
  })
})
