import { NextResponse } from "next/server";
import { db as client } from "@/lib/db"
import bcrypt from "bcryptjs";
import { isValidRegistrationInvite } from "@/lib/registration-invite";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";


export async function POST(req: Request) {
  try {
    if (!rateLimit(`register:ip:${clientIpFromHeaders(req.headers)}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    }

    const { username, password, inviteCode } = (await req.json().catch(() => ({}))) ?? {};

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    if (username.trim().length > 50 || password.length > 200) {
      return NextResponse.json({ error: "Username or password too long" }, { status: 400 });
    }

    if (!isValidRegistrationInvite(inviteCode)) {
      return NextResponse.json({ error: "Invalid or missing invite code" }, { status: 403 });
    }

    // Usernames are stored lowercase; passwords exactly as typed (login doesn't trim them either).
    const sanitizedUsername = username.trim().toLowerCase();
    const sanitizedPassword = password;

    if (sanitizedUsername.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters long" }, { status: 400 });
    }
    // Names show up in chat, presence and the DM's user list: letters, digits, _ . - only.
    if (!/^[\p{L}\p{N}_.-]+$/u.test(sanitizedUsername)) {
      return NextResponse.json({ error: "Usernames may only contain letters, digits, _ . and -" }, { status: 400 });
    }

    if (sanitizedPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    // Login is case-insensitive, so names may not differ only in case (or match the env DM).
    const existingUser = await client.execute({
      sql: "SELECT UserId FROM User WHERE Username = ? COLLATE NOCASE",
      args: [sanitizedUsername],
    });
    const takenByEnvDm = process.env.DM_USERNAME?.trim().toLowerCase() === sanitizedUsername;

    if (existingUser.rows.length > 0 || takenByEnvDm) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(sanitizedPassword, saltRounds);

    // Insert new user
    const result = await client.execute({
      sql: "INSERT INTO User (Username, Password, Role) VALUES (?, ?, ?) RETURNING UserId",
      args: [sanitizedUsername, hashedPassword, "player"],
    });

    return NextResponse.json({
      message: "User registered successfully",
      userId: Number(result.rows[0].UserId),
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Failed to register user" }, { status: 500 });
  }
}
