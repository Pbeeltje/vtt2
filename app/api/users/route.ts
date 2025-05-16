import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { getUserFromCookie } from "@/lib/auth";
import type { User } from "@/app/types/user"; // Import User type

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:./vttdatabase.db",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

export async function GET(req: Request) {
  console.log("Entering GET function in /api/users/route.ts");

  const currentUser = await getUserFromCookie();

  if (!currentUser) {
    console.log("[/api/users] User is not authenticated");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (currentUser.role !== 'DM') {
    console.log("[/api/users] User is not DM, access denied");
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  console.log("[/api/users] User is DM, fetching all users");

  try {
    // Ensure column names in the query match your database schema
    // And alias them to match the User type (id, username, role)
    const result = await client.execute({
      sql: "SELECT UserId as id, Username as username, Role as role FROM User",
      args: [],
    });

    const users: User[] = result.rows as unknown as User[];
    
    console.log("[/api/users] Users fetched:", users.length);
    return NextResponse.json(users);
  } catch (error) {
    console.error("[/api/users] Error fetching users:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch users",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
} 