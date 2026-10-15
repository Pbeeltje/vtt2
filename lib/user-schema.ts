import type { Client } from "@libsql/client";

// User.IsHostAdmin marks the permanent host: the env DM (user 0, see lib/migrate.ts
// ensureEnvDmUser). Only the host can grant or revoke DM for other accounts.

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
