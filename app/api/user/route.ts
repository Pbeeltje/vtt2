import { getUserFromCookie } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { ensureUserIsHostAdminColumn, getUserRowById, rowIsHostAdmin } from "@/lib/user-schema";

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

export async function GET() {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (user.id === 0) {
    return NextResponse.json({ ...user, isHostAdmin: true });
  }

  await ensureUserIsHostAdminColumn(client);
  const row = await getUserRowById(client, user.id);
  if (!row) {
    return NextResponse.json(user);
  }

  return NextResponse.json({
    ...user,
    isHostAdmin: rowIsHostAdmin(row),
  });
}
