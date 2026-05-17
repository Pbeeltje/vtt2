import { NextResponse } from "next/server";
import { getTrimmedRegistrationSecret, isValidRegistrationInvite } from "@/lib/registration-invite";

export async function POST(req: Request) {
  const secret = getTrimmedRegistrationSecret();
  if (!secret) {
    return NextResponse.json({ ok: true });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const inviteCode =
    typeof body === "object" && body !== null && "inviteCode" in body
      ? (body as { inviteCode: unknown }).inviteCode
      : undefined;

  if (!isValidRegistrationInvite(inviteCode)) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
