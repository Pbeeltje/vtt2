import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getTunnelStatus } from "@/lib/tunnel-state";
import { startCloudflaredTunnel, stopCloudflaredTunnel } from "@/lib/cloudflared-tunnel";
import { isHostTunnelFeatureEnabled } from "@/lib/tunnel-feature";

export const runtime = "nodejs";

export async function GET() {
  try {
    try {
      await requireAuth("DM");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isHostTunnelFeatureEnabled()) {
      return NextResponse.json({ enabled: false });
    }

    const { running, url } = getTunnelStatus();
    return NextResponse.json({ enabled: true, running, url });
  } catch (e) {
    console.error("[tunnel GET]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    try {
      await requireAuth("DM");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    try {
      await requireAuth("DM");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isHostTunnelFeatureEnabled()) {
      return NextResponse.json({ error: "Tunnel controls are disabled." }, { status: 403 });
    }

    stopCloudflaredTunnel();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[tunnel DELETE]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
