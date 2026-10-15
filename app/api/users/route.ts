import { NextResponse } from "next/server";
import { db as client } from "@/lib/db"
import { requireAuth } from "@/lib/auth";
import type { User } from "@/app/types/user";
import { rowIsHostAdmin } from "@/lib/user-schema";


export async function GET() {
  try {
    await requireAuth("DM");

    const result = await client.execute({
      sql: "SELECT UserId, Username, Role, IsHostAdmin FROM User ORDER BY Username",
      args: [],
    });

    const users: User[] = result.rows.map((row) => ({
      id: Number(row.UserId),
      username: String(row.Username ?? ""),
      role: String(row.Role ?? "player"),
      isHostAdmin: rowIsHostAdmin(row as { IsHostAdmin?: unknown }),
    }));

    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }
      if (error.message === "Insufficient permissions") {
        return NextResponse.json({ error: "Not authorized - DM access required" }, { status: 403 })
      }
    }
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
} 