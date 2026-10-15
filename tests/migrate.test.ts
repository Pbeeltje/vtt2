import fs from "fs"
import os from "os"
import path from "path"
import { describe, expect, it } from "vitest"
import { createClient } from "@libsql/client"
import { pathToFileURL } from "url"
import { ensureEnvDmUser, loadMigrations, runMigrations } from "@/lib/migrate"

const MIGRATIONS = path.resolve(__dirname, "..", "migrations")

function tempClient() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vtt-migrate-"))
  return createClient({ url: pathToFileURL(path.join(dir, "db.sqlite")).href })
}

async function tables(client: ReturnType<typeof tempClient>) {
  const result = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  return result.rows.map((r) => String(r.name))
}

describe("migrations", () => {
  it("are numbered without gaps", () => {
    expect(loadMigrations(MIGRATIONS).map((m) => m.version)).toEqual(
      loadMigrations(MIGRATIONS).map((_, i) => i + 1)
    )
  })

  it("build a working schema on an empty database and record the version", async () => {
    const client = tempClient()
    const applied = await runMigrations(client, MIGRATIONS)
    expect(applied.length).toBeGreaterThanOrEqual(2)
    expect(await tables(client)).toEqual(
      expect.arrayContaining(["user", "character", "DMImage", "chatmessage", "drawing", "inventory", "item", "job", "notes", "journal_note", "app_setting"])
    )
    const version = (await client.execute("PRAGMA user_version")).rows[0].user_version
    expect(version).toBe(applied[applied.length - 1])
    // Running again does nothing.
    expect(await runMigrations(client, MIGRATIONS)).toEqual([])
  })

  it("upgrade a pre-migration database without losing data", async () => {
    const client = tempClient()
    // A legacy DB: the 001 schema already exists, but user_version was never set.
    await client.executeMultiple(loadMigrations(MIGRATIONS)[0].sql)
    await client.execute("INSERT INTO character (Name) VALUES ('Kept')")
    await client.execute("INSERT INTO inventory (CharacterId, ItemId) VALUES (1, NULL)")
    await runMigrations(client, MIGRATIONS)
    expect((await client.execute("SELECT Name FROM character")).rows[0].Name).toBe("Kept")
    // 002 drops the empty placeholder inventory rows.
    expect((await client.execute("SELECT COUNT(*) AS n FROM inventory")).rows[0].n).toBe(0)
  })
})

describe("ensureEnvDmUser", () => {
  it("creates the host row for the env DM, with an unusable stored password", async () => {
    const client = tempClient()
    await runMigrations(client, MIGRATIONS)
    await ensureEnvDmUser(client)
    const row = (await client.execute("SELECT * FROM user WHERE UserId = 0")).rows[0]
    expect(row).toMatchObject({ Username: "HostDM", Role: "DM", IsHostAdmin: 1, Password: "!" })
  })

  it("takes over an existing user 0 and renames it", async () => {
    const client = tempClient()
    await runMigrations(client, MIGRATIONS)
    await client.execute("INSERT INTO user (UserId, Username, Password, Role) VALUES (0, 'OldDM', 'abcd', 'player')")
    await ensureEnvDmUser(client)
    const row = (await client.execute("SELECT * FROM user WHERE UserId = 0")).rows[0]
    expect(row).toMatchObject({ Username: "HostDM", Role: "DM", IsHostAdmin: 1, Password: "!" })
  })
})
