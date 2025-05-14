import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
// import { db } from '../../lib/db'; // Removed better-sqlite3 import
import { setUserCookie } from "@/lib/auth";
import { createClient } from "@libsql/client"; // Corrected import

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "", // No auth token needed for local file
});

export async function POST(req: Request) {
  // Removed Turso environment check
  try {
    const { username, password, isTestLogin = false } = await req.json();

    console.log("Received login request:", { username, isTestLogin });

    // --- Test DM Login (Keep as is, doesn't interact with DB) ---
    if (isTestLogin) {
      console.log("Handling test login");
      if (username === "DM_User" && password === "dm_password") {
        const userForCookie = {
          id: 0, // Explicitly setting ID 0 for test DM
          username: "DM_User",
          role: "DM" as const,
        };
        console.log("Test login successful, setting cookie");
        try {
          await setUserCookie(userForCookie);
        } catch (cookieError) {
          console.error("Error setting user cookie:", cookieError);
          return NextResponse.json({ error: "Failed to set user cookie", details: cookieError }, { status: 500 });
        }
        return NextResponse.json({ message: "Logged in successfully", role: "DM" });
      } else {
        return NextResponse.json({ error: "Invalid test credentials" }, { status: 401 });
      }
    }
    // --- End Test DM Login ---

    // --- Regular User Login (Use @libsql/client) ---
    // const stmt = db.prepare("SELECT id, Username, Password, Role FROM User WHERE Username = ?"); // Old better-sqlite3 code
    // const user = stmt.get(username) as any; // Old better-sqlite3 code

    const dbResult = await client.execute({
        sql: "SELECT id, Username, Password, Role FROM User WHERE Username = ?",
        args: [username],
    });

    const user = dbResult.rows.length > 0 ? dbResult.rows[0] as any : null; // Cast to any or define a User type

    if (!user) {
      console.log(`Login failed: User "${username}" not found.`);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Ensure the Password field exists before comparing
    if (!user.Password) {
        console.error(`Login failed: User "${username}" found but has no password hash.`);
        return NextResponse.json({ error: "User account error" }, { status: 500 });
    }

    const isMatch = await bcrypt.compare(password, user.Password);

    if (!isMatch) {
      console.log(`Login failed: Password mismatch for user "${username}".`);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Use the correct ID field ('id' based on registration) for the cookie
    const userForCookie = {
      id: user.id, 
      username: user.Username,
      role: user.Role || "player", // Default to "player" if Role is not set
    };

    console.log(`Login successful for user "${username}", setting cookie`);
    try {
      await setUserCookie(userForCookie);
    } catch (cookieError) {
      console.error("Error setting user cookie:", cookieError);
      return NextResponse.json({ error: "Failed to set user cookie", details: cookieError }, { status: 500 });
    }

    return NextResponse.json({ message: "Logged in successfully", role: userForCookie.role });

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      {
        error: "Login failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
