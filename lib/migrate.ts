// Schema migrations: migrations/NNN_name.sql, applied in order and tracked in PRAGMA user_version.
// Runs from server.ts before the server listens (and from tests against a temp DB).
import fs from "fs"
import path from "path"
import type { Client } from "@libsql/client"
import { ENV_DM_USER_ID } from "./env-dm"

type Migration = { version: number; name: string; sql: string }

export function loadMigrations(dir: string): Migration[] {
  return fs
    .readdirSync(dir)
    .map((file) => /^(\d+)_([\w-]+)\.sql$/.exec(file))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ version: Number(m[1]), name: m[0], sql: fs.readFileSync(path.join(dir, m[0]), "utf8") }))
    .sort((a, b) => a.version - b.version)
}

/** Applies every migration newer than the DB's user_version. Each one runs in its own transaction. */
export async function runMigrations(client: Client, dir: string): Promise<number[]> {
  const current = Number((await client.execute("PRAGMA user_version")).rows[0]?.user_version ?? 0)
  const applied: number[] = []
  for (const migration of loadMigrations(dir)) {
    if (migration.version <= current) continue
    try {
      await client.executeMultiple(
        `BEGIN;\n${migration.sql}\n;PRAGMA user_version = ${migration.version};\nCOMMIT;`
      )
    } catch (error) {
      throw new Error(`Migration ${migration.name} failed: ${error instanceof Error ? error.message : error}`)
    }
    applied.push(migration.version)
    console.log(`[db] applied migration ${migration.name}`)
  }
  return applied
}

/**
 * The env DM (DM_USERNAME / DM_PASSWORD) is user 0 and the permanent host. Give it a real
 * row so chat messages and drawings can reference it, and so a fresh DB has a host.
 * Its password lives only in the env; the stored hash is unusable.
 */
export async function ensureEnvDmUser(client: Client): Promise<void> {
  const username = process.env.DM_USERNAME?.trim()
  if (!username || !process.env.DM_PASSWORD) return

  const existing = await client.execute({ sql: "SELECT Username FROM user WHERE UserId = ?", args: [ENV_DM_USER_ID] })
  if (existing.rows.length === 0) {
    await client.execute({
      sql: "INSERT INTO user (UserId, Username, Password, Role, IsHostAdmin) VALUES (?, ?, '!', 'DM', 1)",
      args: [ENV_DM_USER_ID, username],
    })
    return
  }
  await client.execute({
    sql: "UPDATE user SET Role = 'DM', IsHostAdmin = 1, Password = '!' WHERE UserId = ?",
    args: [ENV_DM_USER_ID],
  })
  if (existing.rows[0].Username !== username) {
    try {
      await client.execute({ sql: "UPDATE user SET Username = ? WHERE UserId = ?", args: [username, ENV_DM_USER_ID] })
    } catch {
      console.warn(`[db] DM_USERNAME "${username}" is taken by another account; user 0 keeps its old name.`)
    }
  }
}
