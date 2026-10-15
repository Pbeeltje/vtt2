import { getUserFromCookie } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db as client } from "@/lib/db"
import { getUserRowById, rowIsHostAdmin } from "@/lib/user-schema";


export async function GET() {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const row = await getUserRowById(client, user.id);
  if (!row) {
    return NextResponse.json(user);
  }

  return NextResponse.json({
    ...user,
    isHostAdmin: rowIsHostAdmin(row),
  });
}
