import { NextResponse } from "next/server";
import { getTrimmedRegistrationSecret, isValidRegistrationInvite } from "@/lib/registration-invite";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const secret = getTrimmedRegistrationSecret();
  if (!secret) {
    return NextResponse.json({ ok: true });
  }

  if (!rateLimit(`invite:ip:${clientIpFromHeaders(req.headers)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
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
