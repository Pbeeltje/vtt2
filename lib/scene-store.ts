// Reads and writes scene map state with optimistic concurrency: every write names the version
// it was based on, and the UPDATE only applies if the stored version still matches.
import { db } from "./db"
import { normalizeSceneState, parseSceneData, sceneSummary, type SceneState, type SceneSummary } from "./scene-model"

export type SceneRow = { Id: number; Name: string; Link: string; Category: string; UserId: number; SceneData: string | null }
/** A DMImage row as the lists send it: SceneData replaced by its summary. */
export type SceneListRow = Omit<SceneRow, "SceneData"> & SceneSummary

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

/** Full rows, for server-side passes over every scene. Lists sent to the browser use listSceneSummaries. */
export async function listSceneRows(): Promise<SceneRow[]> {
  const result = await db.execute("SELECT Id, Name, Link, Category, UserId, SceneData FROM DMImage WHERE Category = 'Scene' ORDER BY Id")
  return result.rows.map(toSceneRow)
}

/** DMImage columns for a list: everything but SceneData, plus its SceneSummary fields (see toSummaryRow). */
export const DMIMAGE_SUMMARY_COLUMNS = `Id, Name, Link, Category, UserId,
  (SceneData IS NOT NULL AND SceneData != '') AS HasSceneData,
  CASE WHEN json_valid(SceneData) THEN json_extract(SceneData, '$.scale') END AS Scale,
  CASE WHEN json_valid(SceneData) THEN json_extract(SceneData, '$.borderSize') END AS BorderSize,
  CASE WHEN json_valid(SceneData) THEN json_extract(SceneData, '$.savedAt') END AS SavedAt`

/** A row selected with DMIMAGE_SUMMARY_COLUMNS, with the same defaults parseSceneData would fill in. */
export function toSummaryRow(row: Record<string, unknown>): SceneListRow {
  const { SceneData: _omit, ...base } = toSceneRow(row)
  const state = normalizeSceneState({ scale: row.Scale, borderSize: row.BorderSize, savedAt: row.SavedAt })
  return { ...base, ...sceneSummary(Number(row.HasSceneData) ? state : null) }
}

export async function listSceneSummaries(): Promise<SceneListRow[]> {
  const result = await db.execute(`SELECT ${DMIMAGE_SUMMARY_COLUMNS} FROM DMImage WHERE Category = 'Scene' ORDER BY Id`)
  return result.rows.map(toSummaryRow)
}

export async function getSceneSummary(sceneId: number): Promise<SceneListRow | null> {
  const result = await db.execute({
    sql: `SELECT ${DMIMAGE_SUMMARY_COLUMNS} FROM DMImage WHERE Id = ? AND Category = 'Scene'`,
    args: [sceneId],
  })
  return result.rows[0] ? toSummaryRow(result.rows[0]) : null
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
