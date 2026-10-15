import { getUserFromCookie } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db as client } from "@/lib/db"
import { getUserRowById, rowIsHostAdmin } from "@/lib/user-schema";
import { broadcastPresence, getProfile } from "@/lib/player-profile";
import { isPlayerColor } from "@/lib/player-colors";


export async function GET() {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const row = await getUserRowById(client, user.id);
  if (!row) {
    return NextResponse.json(user);
  }

  const profile = await getProfile(user.id);
  return NextResponse.json({
    ...user,
    isHostAdmin: rowIsHostAdmin(row),
    color: profile?.color,
    avatarUrl: profile?.avatarUrl ?? null,
  });
}

/**
 * Your own profile: `color` (one of the player colours) and `avatarUrl` (an image you uploaded
 * through /api/images, or null for the default silhouette).
 */
export async function PATCH(req: Request) {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { color?: unknown; avatarUrl?: unknown } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    if (body.color !== undefined) {
      if (!isPlayerColor(body.color)) {
        return NextResponse.json({ error: "Pick one of the player colours" }, { status: 400 });
      }
      await client.execute({ sql: "UPDATE user SET Color = ? WHERE UserId = ?", args: [body.color.toLowerCase(), user.id] });
    }

    if (body.avatarUrl !== undefined) {
      if (body.avatarUrl !== null) {
        if (typeof body.avatarUrl !== "string" || !/^\/uploads\/Image\/[\w.-]+$/.test(body.avatarUrl)) {
          return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });
        }
        const owned = await client.execute({
          sql: "SELECT 1 FROM DMImage WHERE Link = ? AND UserId = ? AND Category = 'Image'",
          args: [body.avatarUrl, user.id],
        });
        if (owned.rows.length === 0) {
          return NextResponse.json({ error: "Upload the avatar first" }, { status: 400 });
        }
      }
      await client.execute({ sql: "UPDATE user SET AvatarUrl = ? WHERE UserId = ?", args: [body.avatarUrl, user.id] });
    }

    void broadcastPresence();
    const profile = await getProfile(user.id);
    return NextResponse.json({ color: profile?.color, avatarUrl: profile?.avatarUrl ?? null });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
