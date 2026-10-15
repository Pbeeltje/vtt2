import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  actAs,
  connectClient,
  createCharacter,
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

const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })

beforeAll(async () => {
  await setupTestDb()
  server = await startSocketServer()
  alice = await createUser("alice")
  bob = await createUser("bob")
})

afterAll(async () => {
  await server.close()
})

describe("creating characters", () => {
  it("lets the DM create NPCs and players create their own party members", async () => {
    const { POST } = await import("@/app/api/characters/route")
    await actAs(hostDm)
    const npc = await POST(jsonRequest("/api/characters", "POST", { category: "NPC" }))
    expect(npc.status).toBe(201)
    expect(await npc.json()).toMatchObject({ Name: "New NPC", category: "NPC", userId: 0 })

    await actAs(alice)
    expect((await POST(jsonRequest("/api/characters", "POST", { category: "Monster" }))).status).toBe(403)
    const mine = await POST(jsonRequest("/api/characters", "POST", { category: "Party" }))
    expect(await mine.json()).toMatchObject({ category: "Party", userId: alice.id })
  })

  it("no longer writes inventory rows when listing characters", async () => {
    const { GET } = await import("@/app/api/characters/route")
    await actAs(hostDm)
    await GET()
    const { db } = await import("@/lib/db")
    expect((await db.execute("SELECT COUNT(*) AS n FROM inventory")).rows[0].n).toBe(0)
  })
})

describe("updating characters", () => {
  it("validates fields and only lets the DM reassign", async () => {
    const id = await createCharacter("Aria", alice.id)
    const { PUT } = await import("@/app/api/characters/[id]/route")
    await actAs(alice)
    const bad = await PUT(jsonRequest(`/api/characters/${id}`, "PUT", { Strength: "lots" }), params(id))
    expect(bad.status).toBe(400)
    const ok = await PUT(jsonRequest(`/api/characters/${id}`, "PUT", { Strength: "14", Level: "", userId: bob.id }), params(id))
    expect(await ok.json()).toMatchObject({ Strength: 14, Level: 1, userId: alice.id })

    await actAs(bob)
    expect((await PUT(jsonRequest(`/api/characters/${id}`, "PUT", { Name: "Mine now" }), params(id))).status).toBe(403)
  })

  it("sends updates to DMs and the owner, not to other players", async () => {
    const id = await createCharacter("Secretive", alice.id)
    const owner = await connectClient(server.url, alice)
    const other = await connectClient(server.url, bob)
    const dm = await connectClient(server.url, hostDm)

    await actAs(alice)
    const { PUT } = await import("@/app/api/characters/[id]/route")
    await PUT(jsonRequest(`/api/characters/${id}`, "PUT", { Mind: 12 }), params(id))
    await settle()
    expect(owner.of("character_updated")).toHaveLength(1)
    expect(dm.of("character_updated")).toHaveLength(1)
    expect(other.of("character_updated")).toHaveLength(0)

    // Reassigning tells both the old and the new owner.
    await actAs(hostDm)
    await PUT(jsonRequest(`/api/characters/${id}`, "PUT", { userId: bob.id }), params(id))
    await settle()
    expect(owner.of("character_updated")).toHaveLength(2)
    expect(other.of("character_updated")).toHaveLength(1)
    for (const c of [owner, other, dm]) c.socket.disconnect()
  })
})

describe("deleting characters", () => {
  it("removes jobs, inventory and tokens on every scene (old and new token formats)", async () => {
    const id = await createCharacter("Doomed", alice.id)
    const keep = await createCharacter("Survivor", alice.id)
    const { db } = await import("@/lib/db")
    await db.execute({ sql: "INSERT INTO job (CharacterId, Name, Tier) VALUES (?, 'Squire', 1)", args: [id] })
    const item = await db.execute("INSERT INTO item (Name, Slotnumber) VALUES ('Sword', 1) RETURNING ItemId")
    await db.execute({ sql: "INSERT INTO inventory (CharacterId, ItemId) VALUES (?, ?)", args: [id, item.rows[0].ItemId] })
    const sceneId = await createScene("Battlefield", {
      elements: {
        middleLayer: [],
        topLayer: [
          { id: "new", url: "/a.png", x: 0, y: 0, characterId: id },
          { id: "old", url: "/a.png", x: 0, y: 0, character: { CharacterId: id, Name: "Doomed" } },
          { id: "other", url: "/b.png", x: 0, y: 0, characterId: keep },
        ],
      },
    })
    const owner = await connectClient(server.url, alice)
    owner.socket.emit("join_scene", String(sceneId))

    await actAs(hostDm)
    const { DELETE } = await import("@/app/api/characters/[id]/route")
    const res = await DELETE(jsonRequest(`/api/characters/${id}`, "DELETE"), params(id))
    expect(res.status).toBe(200)
    await settle()

    expect((await db.execute({ sql: "SELECT COUNT(*) AS n FROM character WHERE CharacterId = ?", args: [id] })).rows[0].n).toBe(0)
    expect((await db.execute({ sql: "SELECT COUNT(*) AS n FROM job WHERE CharacterId = ?", args: [id] })).rows[0].n).toBe(0)
    expect((await db.execute("SELECT COUNT(*) AS n FROM item")).rows[0].n).toBe(0)
    const scene = await db.execute({ sql: "SELECT SceneData FROM DMImage WHERE Id = ?", args: [sceneId] })
    expect(JSON.parse(String(scene.rows[0].SceneData)).elements.topLayer.map((t: { id: string }) => t.id)).toEqual(["other"])
    expect(owner.of("character_deleted").map((e) => e.args[0])).toEqual([id])
    owner.socket.disconnect()
  })

  it("is DM-only", async () => {
    const id = await createCharacter("Mine", alice.id)
    await actAs(alice)
    const { DELETE } = await import("@/app/api/characters/[id]/route")
    expect((await DELETE(jsonRequest(`/api/characters/${id}`, "DELETE"), params(id))).status).toBe(403)
  })
})

describe("inventory and jobs", () => {
  it("creates, moves and clears items; refuses items from another character", async () => {
    const id = await createCharacter("Packer", alice.id)
    const other = await createCharacter("Thief", bob.id)
    const slotRoute = await import("@/app/api/characters/[id]/inventory/[slotNumber]/route")
    const invRoute = await import("@/app/api/characters/[id]/inventory/route")
    const slot = (n: number, cid = id) => ({ params: Promise.resolve({ id: String(cid), slotNumber: String(n) }) })

    await actAs(alice)
    expect((await slotRoute.PUT(jsonRequest("/x", "PUT", { Name: "Rope" }), slot(3))).status).toBe(200)
    const inv = await (await invRoute.GET(jsonRequest("/x", "GET"), params(id))).json()
    const rope = inv.Slots[2]
    expect(rope.item).toMatchObject({ Name: "Rope" })

    expect((await invRoute.PUT(jsonRequest("/x", "PUT", { Slots: [{ SlotNumber: 5, ItemId: rope.ItemId }] }), params(id))).status).toBe(200)
    const moved = await (await invRoute.GET(jsonRequest("/x", "GET"), params(id))).json()
    expect(moved.Slots[4].item?.Name).toBe("Rope")

    await actAs(bob)
    expect((await invRoute.PUT(jsonRequest("/x", "PUT", { Slots: [{ SlotNumber: 1, ItemId: rope.ItemId }] }), params(other))).status).toBe(403)

    await actAs(alice)
    expect((await invRoute.PUT(jsonRequest("/x", "PUT", { Slots: [{ SlotNumber: 5, ItemId: null }] }), params(id))).status).toBe(200)
    const cleared = await (await invRoute.GET(jsonRequest("/x", "GET"), params(id))).json()
    expect(cleared.Slots.every((s: { item: unknown }) => s.item === null)).toBe(true)
  })

  it("validates job tiers and deletes jobs", async () => {
    const id = await createCharacter("Worker", alice.id)
    const jobs = await import("@/app/api/characters/[id]/jobs/route")
    const job = await import("@/app/api/characters/[id]/jobs/[jobId]/route")
    await actAs(alice)
    const created = await (await jobs.POST(jsonRequest("/x", "POST", { name: "Squire", tier: 1 }), params(id))).json()
    const jobParams = { params: Promise.resolve({ id: String(id), jobId: String(created.JobId) }) }
    expect((await job.PUT(jsonRequest("/x", "PUT", { name: "Squire" }), jobParams)).status).toBe(200)
    expect((await job.PUT(jsonRequest("/x", "PUT", { name: "Squire", tier: 9 }), jobParams)).status).toBe(400)
    expect((await job.DELETE(jsonRequest("/x", "DELETE"), jobParams)).status).toBe(200)
    expect(await (await jobs.GET(jsonRequest("/x", "GET"), params(id))).json()).toEqual([])
  })
})
