import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { requireAuth } from "@/lib/auth";
import type { User } from "@/app/types/user"; // Import User type

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "", // No auth token needed for local file
});

export async function GET(req: Request) {
  try {
    // Only DMs can access user list
    const user = await requireAuth('DM');

    const result = await client.execute({
      sql: "SELECT UserId, Username, Role FROM User ORDER BY Username",
      args: [],
    });

    return NextResponse.json(result.rows);
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