// The one database client for the whole app (API routes, auth, socket server, scripts).
//
// The file is DATABASE_PATH, or <cwd>/vttdatabase.db. server.ts sets DATABASE_PATH to the
// project root before anything opens the DB, so the working directory no longer matters.
//
// Use `db.batch([...], "write")` for multi-statement writes, not `db.transaction()`:
// libsql hands the connection to the transaction and opens a fresh one afterwards.
import { createClient, type Client } from "@libsql/client"
import path from "path"
import { pathToFileURL } from "url"

// Process-wide key: route bundles each get their own copy of this module but share one client.
const GLOBAL_DB_KEY = "__vttDbClient"
type DbGlobal = { [GLOBAL_DB_KEY]?: Client }

export function databasePath(): string {
  const configured = process.env.DATABASE_PATH?.trim()
  return configured ? path.resolve(configured) : path.join(process.cwd(), "vttdatabase.db")
}

export function getDb(): Client {
  const g = globalThis as DbGlobal
  if (!g[GLOBAL_DB_KEY]) {
    const client = createClient({ url: pathToFileURL(databasePath()).href })
    // WAL is stored in the file; the others are per connection (libsql turns foreign_keys on by default).
    // synchronous = NORMAL is safe under WAL (a power cut can lose the last commits, never corrupt);
    // busy_timeout makes a write wait for another process's lock instead of failing with SQLITE_BUSY.
    void client.execute("PRAGMA journal_mode = WAL").catch(() => {})
    void client.execute("PRAGMA synchronous = NORMAL").catch(() => {})
    void client.execute("PRAGMA busy_timeout = 5000").catch(() => {})
    void client.execute("PRAGMA foreign_keys = ON").catch(() => {})
    g[GLOBAL_DB_KEY] = client
  }
  return g[GLOBAL_DB_KEY]!
}

/** Lazily-opened shared client, so importing this module never touches the disk. */
export const db: Client = new Proxy({} as Client, {
  get(_target, prop) {
    const client = getDb()
    const value = Reflect.get(client, prop, client)
    return typeof value === "function" ? value.bind(client) : value
  },
})
