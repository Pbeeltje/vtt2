import { NextResponse } from "next/server";
import { authenticateAndSetCookie } from "@/lib/auth";

// JSON login endpoint (the UI uses the loginUser server action; both share the same checks).
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username, password } = (body ?? {}) as { username?: unknown; password?: unknown };
  const result = await authenticateAndSetCookie(username, password);

  if (!result.success) {
    const status = result.error?.startsWith("Too many") ? 429 : 401;
    return NextResponse.json({ error: result.error || "Invalid credentials" }, { status });
  }
  return NextResponse.json({ message: "Logged in successfully", role: result.role });
}
