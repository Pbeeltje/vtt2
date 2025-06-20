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
  try {
    const { username, password } = await req.json();

    // Input validation
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: "Username and password are required and must be strings" }, { status: 400 });
    }

    // Sanitize inputs
    const sanitizedUsername = username.trim();
    if (sanitizedUsername.length < 3 || sanitizedUsername.length > 50) {
      return NextResponse.json({ error: "Username must be between 3 and 50 characters" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    // Check for DM user (configurable via environment variables)
    const dmUsername = process.env.DM_USERNAME;
    const dmPassword = process.env.DM_PASSWORD;
    
    if (sanitizedUsername === dmUsername && dmPassword && password === dmPassword) {
      // Only allow DM login if environment variables are configured
      const userForCookie = {
        id: 0,
        username: dmUsername,
        role: "DM" as const,
      };
      
      try {
        await setUserCookie(userForCookie);
        return NextResponse.json({ message: "Logged in successfully", role: "DM" });
      } catch (cookieError) {
        console.error("Error setting user cookie:", cookieError);
        return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
      }
    }

    // Regular user login
    const dbResult = await client.execute({
        sql: "SELECT id, Username, Password, Role FROM User WHERE Username = ?",
        args: [sanitizedUsername],
    });

    const user = dbResult.rows.length > 0 ? dbResult.rows[0] as any : null;

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.Password) {
        console.error(`Login failed: User "${sanitizedUsername}" found but has no password hash.`);
        return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
    }

    const isMatch = await bcrypt.compare(password, user.Password);

    if (!isMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const userForCookie = {
      id: user.id, 
      username: user.Username,
      role: user.Role || "player",
    };

    try {
      await setUserCookie(userForCookie);
    } catch (cookieError) {
      console.error("Error setting user cookie:", cookieError);
      return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
    }

    return NextResponse.json({ message: "Logged in successfully", role: userForCookie.role });

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
