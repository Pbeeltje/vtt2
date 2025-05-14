import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient } from "@libsql/client"

const client = createClient({
  url: "file:./vttdatabase.db", // Changed to local DB
  authToken: "", // No auth token needed for local file
})

export async function POST(req: Request) {
  console.log("Registration attempt received");
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    // Check if user already exists using @libsql/client
    const existingUserResult = await client.execute({
        sql: "SELECT UserId FROM User WHERE Username = ?",
        args: [username],
    });

    if (existingUserResult.rows.length > 0) {
      console.log(`Registration failed: Username "${username}" already exists.`);
      return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user using @libsql/client
    const result = await client.execute({
        sql: "INSERT INTO User (Username, Password) VALUES (?, ?)",
        args: [username, hashedPassword],
    });

    if (!result.lastInsertRowid) {
      console.error(`Registration failed: Could not insert user "${username}" into DB.`);
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    console.log(`User "${username}" registered successfully with ID: ${result.lastInsertRowid}`);
    return NextResponse.json({ message: "User registered successfully", userId: result.lastInsertRowid });

  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        error: "Registration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
