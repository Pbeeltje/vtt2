import type { Client } from "@libsql/client";

/**
 * Adds IsHostAdmin (0/1) for delegated-DM vs permanent host rules.
 * Safe to call repeatedly.
 */
export async function ensureUserIsHostAdminColumn(client: Client): Promise<void> {
  try {
    await client.execute({
      sql: "ALTER TABLE User ADD COLUMN IsHostAdmin INTEGER NOT NULL DEFAULT 0",
      args: [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/duplicate column|already exists/i.test(msg)) {
      console.warn("[user-schema] ALTER User IsHostAdmin:", msg);
    }
  }
}

function countValue(row: Record<string, unknown> | undefined): number {
  if (!row) return 0;
  const v = row.c ?? row.C ?? Object.values(row)[0];
  return Number(v ?? 0);
}

/** If no host is designated yet, mark this DM as the permanent host (first DM to load the user list). */
export async function crownHostAdminIfNone(client: Client, dmUserId: number): Promise<void> {
  if (!Number.isFinite(dmUserId) || dmUserId < 0) return;
  const cnt = await client.execute({
    sql: "SELECT COUNT(*) AS c FROM User WHERE IsHostAdmin = 1",
    args: [],
  });
  if (countValue(cnt.rows[0] as Record<string, unknown>) > 0) return;
  await client.execute({
    sql: "UPDATE User SET IsHostAdmin = 1 WHERE UserId = ?",
    args: [dmUserId],
  });
}

export async function getUserRowById(
  client: Client,
  userId: number
): Promise<{ UserId: number; Username: string; Role: string; IsHostAdmin: number } | null> {
  const r = await client.execute({
    sql: "SELECT UserId, Username, Role, IsHostAdmin FROM User WHERE UserId = ?",
    args: [userId],
  });
  if (r.rows.length === 0) return null;
  const row = r.rows[0] as Record<string, unknown>;
  return {
    UserId: Number(row.UserId),
    Username: String(row.Username ?? ""),
    Role: String(row.Role ?? "player"),
    IsHostAdmin: Number(row.IsHostAdmin ?? 0),
  };
}

export function rowIsHostAdmin(row: { IsHostAdmin?: unknown }): boolean {
  return Number(row.IsHostAdmin ?? 0) === 1;
}
