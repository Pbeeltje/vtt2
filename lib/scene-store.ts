// Reads and writes scene map state with optimistic concurrency: every write names the version
// it was based on, and the UPDATE only applies if the stored version still matches.
import { db } from "./db"
import { normalizeSceneState, parseSceneData, type SceneState } from "./scene-model"

export type SceneRow = { Id: number; Name: string; Link: string; Category: string; UserId: number; SceneData: string | null }

function toSceneRow(row: Record<string, unknown>): SceneRow {
  return {
    Id: Number(row.Id),
    Name: String(row.Name ?? ""),
    Link: String(row.Link ?? ""),
    Category: String(row.Category ?? "Scene"),
    UserId: Number(row.UserId ?? 0),
    SceneData: row.SceneData === null || row.SceneData === undefined ? null : String(row.SceneData),
  }
}

export async function getSceneRow(sceneId: number): Promise<SceneRow | null> {
  const result = await db.execute({
    sql: "SELECT Id, Name, Link, Category, UserId, SceneData FROM DMImage WHERE Id = ? AND Category = 'Scene'",
    args: [sceneId],
  })
  return result.rows[0] ? toSceneRow(result.rows[0]) : null
}

export async function listSceneRows(): Promise<SceneRow[]> {
  const result = await db.execute("SELECT Id, Name, Link, Category, UserId, SceneData FROM DMImage WHERE Category = 'Scene' ORDER BY Id")
  return result.rows.map(toSceneRow)
}

/** Writes `next` (as version expectedVersion + 1) only if the stored version is still expectedVersion. */
export async function writeSceneIfVersion(
  sceneId: number,
  next: SceneState,
  expectedVersion: number
): Promise<SceneState | null> {
  const saved: SceneState = { ...normalizeSceneState(next), version: expectedVersion + 1, savedAt: new Date().toISOString() }
  const result = await db.execute({
    sql: `UPDATE DMImage SET SceneData = ?
          WHERE Id = ? AND Category = 'Scene'
            AND COALESCE(json_extract(SceneData, '$.version'), 0) = ?`,
    args: [JSON.stringify(saved), sceneId, expectedVersion],
  })
  return result.rowsAffected === 1 ? saved : null
}

export type SceneMutation = (state: SceneState) => SceneState | { error: string; status: number }

/**
 * Read-modify-write with retries, for small server-side edits (a player moving a token).
 * Returns the saved state, or the mutation's error.
 */
export async function updateScene(
  sceneId: number,
  mutate: SceneMutation,
  attempts = 5
): Promise<{ state: SceneState } | { error: string; status: number }> {
  for (let i = 0; i < attempts; i++) {
    const row = await getSceneRow(sceneId)
    if (!row) return { error: "Scene not found", status: 404 }
    const current = parseSceneData(row.SceneData)
    const next = mutate(current)
    if ("error" in next) return next
    const saved = await writeSceneIfVersion(sceneId, next, current.version)
    if (saved) return { state: saved }
  }
  return { error: "The scene is busy; try again", status: 409 }
}
