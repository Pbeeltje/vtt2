import { NextResponse } from "next/server";
import { registrationInviteRequired } from "@/lib/registration-invite";

/** Public: whether the register flow should ask for an invite before account fields. */
export async function GET() {
  return NextResponse.json({ requiresInviteCode: registrationInviteRequired() });
}
