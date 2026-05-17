import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { requireAuth } from "@/lib/auth";
import { ensureUserIsHostAdminColumn, getUserRowById, rowIsHostAdmin } from "@/lib/user-schema";

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

type RoleBody = { role?: string };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor: Awaited<ReturnType<typeof requireAuth>>;
  try {
    actor = await requireAuth("DM");
  } catch (e) {
    if (e instanceof Error && e.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "DM only" }, { status: 403 });
  }
  const { id: idParam } = await params;
  const targetId = parseInt(idParam, 10);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  if (targetId === actor.id) {
    return NextResponse.json({ error: "You cannot change your own role here." }, { status: 403 });
  }

  let body: RoleBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const nextRole = body.role === "DM" || body.role === "player" ? body.role : null;
  if (!nextRole) {
    return NextResponse.json({ error: "role must be \"DM\" or \"player\"" }, { status: 400 });
  }

  await ensureUserIsHostAdminColumn(client);

  const actorRow = await getUserRowById(client, actor.id);
  const targetRow = await getUserRowById(client, targetId);

  if (!actorRow) {
    return NextResponse.json(
      { error: "Your login is not linked to a database user (e.g. test DM). Use a full account to manage roles." },
      { status: 403 }
    );
  }

  if (!targetRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const actorIsHost = rowIsHostAdmin(actorRow);

  if (rowIsHostAdmin(targetRow)) {
    return NextResponse.json(
      { error: "The host account cannot be demoted or have its admin role changed." },
      { status: 403 }
    );
  }

  if (!actorIsHost) {
    return NextResponse.json(
      { error: "Only the host can grant or revoke admin (DM) for other users." },
      { status: 403 }
    );
  }

  if (targetRow.Role === nextRole) {
    return NextResponse.json({
      id: targetRow.UserId,
      username: targetRow.Username,
      role: targetRow.Role,
      isHostAdmin: false,
    });
  }

  await client.execute({
    sql: "UPDATE User SET Role = ? WHERE UserId = ?",
    args: [nextRole, targetId],
  });

  return NextResponse.json({
    id: targetRow.UserId,
    username: targetRow.Username,
    role: nextRole,
    isHostAdmin: false,
  });
}
