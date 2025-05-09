import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from '../../lib/db'; // Import the local db instance

export async function POST(req: Request) {
  console.log("Registration attempt received");
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    // Check if user already exists using better-sqlite3
    const checkUserStmt = db.prepare("SELECT UserId FROM User WHERE Username = ?"); // Corrected 'id' to 'UserId'
    const existingUser = checkUserStmt.get(username);

    if (existingUser) {
      console.log(`Registration failed: Username "${username}" already exists.`);
      return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user using better-sqlite3
    // Assuming 'Role' defaults to 'player' or is nullable, otherwise add it
    const insertStmt = db.prepare(
      "INSERT INTO User (Username, Password) VALUES (?, ?)" 
    );
    const info = insertStmt.run(username, hashedPassword);

    // Check if insert was successful
    if (info.changes === 0) {
      console.error(`Registration failed: Could not insert user "${username}" into DB.`);
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    console.log(`User "${username}" registered successfully with ID: ${info.lastInsertRowid}`);
    return NextResponse.json({ message: "User registered successfully", userId: info.lastInsertRowid });

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
