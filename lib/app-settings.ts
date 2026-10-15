// Table-wide settings stored in app_setting (see migrations/002).
import { db } from "./db"

export async function getSetting(key: string): Promise<string | null> {
  const result = await db.execute({ sql: "SELECT Value FROM app_setting WHERE Key = ?", args: [key] })
  const value = result.rows[0]?.Value
  return value === undefined || value === null ? null : String(value)
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  await db.execute({
    sql: "INSERT INTO app_setting (Key, Value) VALUES (?, ?) ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value",
    args: [key, value],
  })
}

/** The scene the DM made active for players, or null if none was ever set. */
export async function getActiveSceneId(): Promise<number | null> {
  const raw = await getSetting("activeSceneId")
  const id = raw === null ? NaN : Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function setActiveSceneId(sceneId: number): Promise<void> {
  await setSetting("activeSceneId", String(sceneId))
}
