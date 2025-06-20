import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "", // No auth token needed for local file
});

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    // Sanitize inputs
    const sanitizedUsername = username.trim().toLowerCase();
    const sanitizedPassword = password.trim();

    if (sanitizedUsername.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters long" }, { status: 400 });
    }

    if (sanitizedPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
    }

    // Check if username already exists
    const existingUser = await client.execute({
      sql: "SELECT UserId FROM User WHERE Username = ?",
      args: [sanitizedUsername],
    });

    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(sanitizedPassword, saltRounds);

    // Insert new user
    const result = await client.execute({
      sql: "INSERT INTO User (Username, Password, Role) VALUES (?, ?, ?) RETURNING *",
      args: [sanitizedUsername, hashedPassword, "player"],
    });

    if (!result.lastInsertRowid) {
      throw new Error("Failed to create user");
    }

    return NextResponse.json({ 
      message: "User registered successfully",
      userId: result.lastInsertRowid 
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ 
      error: "Failed to register user",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
