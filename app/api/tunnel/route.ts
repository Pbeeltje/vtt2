import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getTunnelStatus } from "@/lib/tunnel-state";
import { startCloudflaredTunnel, stopCloudflaredTunnel } from "@/lib/cloudflared-tunnel";
import { isHostTunnelFeatureEnabled } from "@/lib/tunnel-feature";
import { db } from "@/lib/db";
import { getUserRowById, rowIsHostAdmin } from "@/lib/user-schema";

/** Opening the table to the internet is the host's call, not any DM's. */
async function requireHost(): Promise<boolean> {
  try {
    const user = await requireAuth("DM");
    const row = await getUserRowById(db, user.id);
    return row !== null && rowIsHostAdmin(row);
  } catch {
    return false;
  }
}

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!(await requireHost())) {
      return NextResponse.json({ error: "Only the host can control the tunnel" }, { status: 403 });
    }

    if (!isHostTunnelFeatureEnabled()) {
      return NextResponse.json({ enabled: false });
    }

    const { running, url } = getTunnelStatus();
    return NextResponse.json({ enabled: true, running, url });
  } catch (e) {
    console.error("[tunnel GET]", e);
    return NextResponse.json({ error: "Tunnel request failed" }, { status: 500 });
  }
}

export async function POST() {
  try {
    if (!(await requireHost())) {
      return NextResponse.json({ error: "Only the host can control the tunnel" }, { status: 403 });
    }

    if (!isHostTunnelFeatureEnabled()) {
      return NextResponse.json({ error: "Tunnel controls are disabled in this environment." }, { status: 403 });
    }

    const port = parseInt(process.env.PORT || "3000", 10);
    const url = await startCloudflaredTunnel(port);
    return NextResponse.json({ url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to start tunnel.";
    console.error("[tunnel POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    if (!(await requireHost())) {
      return NextResponse.json({ error: "Only the host can control the tunnel" }, { status: 403 });
    }

    if (!isHostTunnelFeatureEnabled()) {
      return NextResponse.json({ error: "Tunnel controls are disabled." }, { status: 403 });
    }

    stopCloudflaredTunnel();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[tunnel DELETE]", e);
    return NextResponse.json({ error: "Tunnel request failed" }, { status: 500 });
  }
}
