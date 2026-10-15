import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
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
import type { SceneState } from "@/lib/scene-model"

let server: Awaited<ReturnType<typeof startSocketServer>>
let alice: TestUser
let bob: TestUser
let aliceHero: number
let bobHero: number

const scenesRoute = () => import("@/app/api/scenes/route")
const sceneRoute = () => import("@/app/api/scenes/[id]/route")
const setActiveRoute = () => import("@/app/api/scenes/set-active/route")
const playerTokenRoute = () => import("@/app/api/scenes/player-token/route")

const params = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) })

async function saveScene(sceneId: number, sceneData: Partial<SceneState>, baseVersion: number, socketId?: string) {
  await actAs(hostDm)
  const { POST } = await scenesRoute()
  return POST(jsonRequest("/api/scenes", "POST", { sceneId, sceneData, baseVersion }, socketId ? { "X-Socket-Id": socketId } : {}))
}

async function setActive(sceneId: number) {
  await actAs(hostDm)
  const { POST } = await setActiveRoute()
  return POST(jsonRequest("/api/scenes/set-active", "POST", { sceneId }))
}

const heroToken = (id: string, characterId: number, x = 0) => ({ id, url: "/t.png", x, y: 0, characterId })

beforeAll(async () => {
  await setupTestDb()
  server = await startSocketServer()
  alice = await createUser("alice")
  bob = await createUser("bob")
  aliceHero = await createCharacter("Aria", alice.id)
  bobHero = await createCharacter("Bram", bob.id)
})

afterAll(async () => {
  await server.close()
})

describe("scene list and access", () => {
  let active: number
  let prep: number

  beforeAll(async () => {
    active = await createScene("Tavern", { gridSize: 50 })
    prep = await createScene("Secret Dungeon", { gridSize: 50, darknessPaths: [] })
    await setActive(active)
  })

  it("persists the active scene", async () => {
    await actAs(alice)
    const { GET } = await setActiveRoute()
    expect(await (await GET()).json()).toEqual({ sceneId: active })
  })

  it("gives players only the active scene, and the DM all of them", async () => {
    const { GET } = await scenesRoute()
    await actAs(alice)
    const forPlayer = await (await GET()).json()
    expect(forPlayer.map((s: { Id: number }) => s.Id)).toEqual([active])
    await actAs(hostDm)
    const forDm = await (await GET()).json()
    expect(forDm.map((s: { Id: number }) => s.Id)).toEqual(expect.arrayContaining([active, prep]))
  })

  it("lists scenes as summaries; the full map state only comes with a single scene", async () => {
    const big = await createScene("Summarised", { scale: 2, borderSize: 0.5, savedAt: "2026-02-03T00:00:00.000Z", gridSize: 40 })
    const broken = await createScene("Broken", null)
    const { db } = await import("@/lib/db")
    await db.execute({ sql: "UPDATE DMImage SET SceneData = '{oops' WHERE Id = ?", args: [broken] })

    await actAs(hostDm)
    const { GET } = await scenesRoute()
    const list = await (await GET()).json()
    const row = (id: number) => list.find((s: { Id: number }) => s.Id === id)
    expect(row(big)).toEqual({
      Id: big, Name: "Summarised", Link: "/uploads/Scene/Summarised.png", Category: "Scene", UserId: 0,
      HasSceneData: true, Scale: 2, BorderSize: 0.5, SavedAt: "2026-02-03T00:00:00.000Z",
    })
    // Same defaults parseSceneData would give.
    expect(row(broken)).toMatchObject({ HasSceneData: true, Scale: 1, BorderSize: 0.2, SavedAt: null })
    expect(list.every((s: Record<string, unknown>) => !("SceneData" in s))).toBe(true)

    const { GET: getImages } = await import("@/app/api/images/route")
    const images = await (await getImages(jsonRequest("/api/images", "GET"))).json()
    expect(images.find((i: { Id: number }) => i.Id === big)).toEqual(row(big))

    const { GET: getOne } = await sceneRoute()
    const full = await (await getOne(jsonRequest(`/api/scenes/${big}`, "GET"), params(big))).json()
    expect(JSON.parse(full.SceneData)).toMatchObject({ scale: 2, gridSize: 40 })
  })

  it("hides other scenes from players by id", async () => {
    const { GET } = await sceneRoute()
    await actAs(alice)
    expect((await GET(jsonRequest(`/api/scenes/${prep}`, "GET"), params(prep))).status).toBe(404)
    expect((await GET(jsonRequest(`/api/scenes/${active}`, "GET"), params(active))).status).toBe(200)
  })

  it("rejects logged-out users", async () => {
    await actAs(null)
    const { GET } = await scenesRoute()
    expect((await GET()).status).toBe(401)
  })

  it("only lets players' sockets follow the active scene", async () => {
    const player = await connectClient(server.url, alice)
    const dm = await connectClient(server.url, hostDm)
    player.socket.emit("join_scene", String(prep))
    player.socket.emit("join_scene", String(active))
    dm.socket.emit("join_scene", String(prep))
    await settle()

    await saveScene(prep, { gridSize: 60 }, 0)
    await saveScene(active, { gridSize: 70 }, 0)
    await settle()

    expect(player.of("scene_updated").map((e) => e.args[0])).toEqual([active])
    expect(dm.of("scene_updated").map((e) => e.args[0])).toEqual([prep])
    player.socket.disconnect()
    dm.socket.disconnect()
  })
})

describe("versioned saves", () => {
  let sceneId: number

  beforeEach(async () => {
    sceneId = await createScene(`Map ${Math.random()}`, null)
    await setActive(sceneId)
  })

  it("bumps the version and rejects saves based on an old version", async () => {
    const first = await saveScene(sceneId, { gridSize: 40 }, 0)
    expect(first.status).toBe(200)
    expect((await first.json()).state.version).toBe(1)

    const stale = await saveScene(sceneId, { gridSize: 45 }, 0)
    expect(stale.status).toBe(409)
    const body = await stale.json()
    expect(body.state).toMatchObject({ version: 1, gridSize: 40 })
  })

  it("does not lose a player's token move to a stale DM save", async () => {
    await saveScene(sceneId, { elements: { middleLayer: [], topLayer: [heroToken("t1", aliceHero)] } }, 0)

    await actAs(alice)
    const { PUT } = await playerTokenRoute()
    const moved = await PUT(jsonRequest("/api/scenes/player-token", "PUT", { sceneId, tokenData: { id: "t1", x: 150, y: 0 } }))
    expect(moved.status).toBe(200)

    // The DM's autosave still thinks the scene is at version 1.
    const dmSave = await saveScene(sceneId, { gridColor: "red", elements: { middleLayer: [], topLayer: [heroToken("t1", aliceHero)] } }, 1)
    expect(dmSave.status).toBe(409)
    expect((await dmSave.json()).state.elements.topLayer[0].x).toBe(150)
  })

  it("broadcasts the full state (fog included) to the scene, but not back to the sender", async () => {
    const dm = await connectClient(server.url, hostDm)
    const player = await connectClient(server.url, alice)
    const guest = await connectClient(server.url, null)
    for (const c of [dm, player, guest]) c.socket.emit("join_scene", String(sceneId))
    await settle()

    const fog = [{ id: "f1", type: "erase", createdAt: "2026-01-01", path: "M0,0 L5,5" }]
    const res = await saveScene(sceneId, { darknessPaths: fog as SceneState["darknessPaths"], isDarknessLayerVisible: true }, 0, dm.socket.id)
    expect(res.status).toBe(200)
    await settle()

    expect(dm.of("scene_updated")).toHaveLength(0)
    expect(guest.of("scene_updated")).toHaveLength(0)
    const [event] = player.of("scene_updated")
    expect(event.args[0]).toBe(sceneId)
    expect(event.args[1]).toMatchObject({ version: 1, isDarknessLayerVisible: true, darknessPaths: fog })
    for (const c of [dm, player, guest]) c.socket.disconnect()
  })

  it("stores and broadcasts the fog compacted", async () => {
    const at = (s: number) => `2026-01-01T00:00:0${s}`
    const rect = { x: 0, y: 0, width: 50, height: 50 }
    const fog = [
      { id: "p0", type: "paint", createdAt: at(0), cellRect: { x: 50, y: 0, width: 50, height: 50 } },
      { id: "e1", type: "erase", createdAt: at(1), cellRect: rect },
      { id: "p2", type: "paint", createdAt: at(2), cellRect: rect },
      { id: "e3", type: "erase", createdAt: at(3), cellRect: rect },
    ]
    const res = await saveScene(sceneId, { darknessPaths: fog as SceneState["darknessPaths"] }, 0)
    expect((await res.json()).state.darknessPaths.map((p: { id: string }) => p.id)).toEqual(["e3"])
    const { db } = await import("@/lib/db")
    const stored = await db.execute({ sql: "SELECT SceneData FROM DMImage WHERE Id = ?", args: [sceneId] })
    expect(JSON.parse(String(stored.rows[0].SceneData)).darknessPaths.map((p: { id: string }) => p.id)).toEqual(["e3"])
  })

  it("only lets the DM save the whole scene", async () => {
    await actAs(alice)
    const { POST } = await scenesRoute()
    const res = await POST(jsonRequest("/api/scenes", "POST", { sceneId, sceneData: {}, baseVersion: 0 }))
    expect(res.status).toBe(403)
  })
})

describe("player tokens", () => {
  let sceneId: number

  beforeAll(async () => {
    sceneId = await createScene("Arena", null)
    await setActive(sceneId)
  })

  it("lets a player place their own character's token, stamped with the real owner", async () => {
    await actAs(alice)
    const { POST } = await playerTokenRoute()
    const res = await POST(jsonRequest("/api/scenes/player-token", "POST", {
      sceneId,
      tokenData: { id: "aria-1", url: "/a.png", x: 0, y: 0, character: { CharacterId: aliceHero, Name: "Aria", userId: 999 } },
    }))
    expect(res.status).toBe(200)
    const { tokenData } = await res.json()
    expect(tokenData).toMatchObject({ characterId: aliceHero, character: { userId: alice.id } })
  })

  it("refuses another player's character, and moving or deleting another player's token", async () => {
    const { POST, PUT, DELETE } = await playerTokenRoute()
    await actAs(bob)
    const place = await POST(jsonRequest("/api/scenes/player-token", "POST", {
      sceneId,
      tokenData: { id: "fake", url: "/a.png", x: 0, y: 0, characterId: aliceHero },
    }))
    expect(place.status).toBe(403)
    const move = await PUT(jsonRequest("/api/scenes/player-token", "PUT", { sceneId, tokenData: { id: "aria-1", x: 99, y: 99 } }))
    expect(move.status).toBe(403)
    const del = await DELETE(new Request(`http://test/api/scenes/player-token?sceneId=${sceneId}&tokenId=aria-1`, { method: "DELETE" }))
    expect(del.status).toBe(403)
  })

  it("only works on the active scene", async () => {
    const other = await createScene("Elsewhere", null)
    await actAs(bob)
    const { POST } = await playerTokenRoute()
    const res = await POST(jsonRequest("/api/scenes/player-token", "POST", {
      sceneId: other,
      tokenData: { id: "bram-1", url: "/b.png", x: 0, y: 0, characterId: bobHero },
    }))
    expect(res.status).toBe(403)
  })

  it("rejects duplicate token ids", async () => {
    await actAs(alice)
    const { POST } = await playerTokenRoute()
    const res = await POST(jsonRequest("/api/scenes/player-token", "POST", {
      sceneId,
      tokenData: { id: "aria-1", url: "/a.png", x: 5, y: 5, characterId: aliceHero },
    }))
    expect(res.status).toBe(409)
  })
})

describe("scene scale", () => {
  it("rescales a scene that is not loaded, including its drawings", async () => {
    const sceneId = await createScene("Big", { scale: 1, elements: { middleLayer: [], topLayer: [heroToken("t", aliceHero, 100)] } })
    const { db } = await import("@/lib/db")
    await db.execute({
      sql: "INSERT INTO drawing (id, path, color, createdBy, sceneId) VALUES ('d1', 'M10,10 L20,20', '#000', 0, ?)",
      args: [sceneId],
    })

    await actAs(hostDm)
    const { PATCH } = await sceneRoute()
    const res = await PATCH(jsonRequest(`/api/scenes/${sceneId}`, "PATCH", { scale: 2, borderSize: 0.5 }), params(sceneId))
    expect(res.status).toBe(200)
    const { state } = await res.json()
    expect(state).toMatchObject({ scale: 2, borderSize: 0.5 })
    expect(state.elements.topLayer[0].x).toBe(200)
    const drawing = await db.execute("SELECT path FROM drawing WHERE id = 'd1'")
    expect(drawing.rows[0].path).toBe("M20,20 L40,40")
  })
})
