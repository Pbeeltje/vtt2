"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Copy, Globe, Loader2, Square, X } from "lucide-react";

const DISMISS_KEY = "vtt-dismiss-tunnel-share-popup";

type TunnelGet = { enabled: boolean; running?: boolean; url?: string | null };

export function HostTunnelShare({ visible }: { visible: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!visible) return;
    try {
      const res = await fetch("/api/tunnel", { credentials: "include" });
      if (res.status === 403) {
        setChecked(true);
        setEnabled(false);
        return;
      }
      const data = (await res.json()) as TunnelGet;
      setChecked(true);
      setEnabled(!!data.enabled);
      if (data.enabled) {
        setUrl(data.url ?? null);
      }
    } catch {
      setChecked(true);
      setEnabled(false);
    }
  }, [visible]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!visible || !url) return;
    const id = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(id);
  }, [visible, url, refresh]);

  const start = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/tunnel", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Tunnel failed",
          description: typeof data.error === "string" ? data.error : res.statusText,
          variant: "destructive",
        });
        return;
      }
      if (typeof data.url === "string") {
        setUrl(data.url);
        toast({ title: "Share link ready", description: "Copy the URL and send it to your players." });
      }
    } catch {
      toast({ title: "Tunnel failed", description: "Network error.", variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    try {
      await fetch("/api/tunnel", { method: "DELETE", credentials: "include" });
      setUrl(null);
      toast({ title: "Tunnel stopped" });
    } catch {
      toast({ title: "Stop failed", variant: "destructive" });
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (!visible || !checked || !enabled || dismissed) return null;

  return (
    <div className="fixed bottom-[4.5rem] left-3 z-[200] max-w-sm rounded-lg border bg-background/95 p-3 pr-9 shadow-md backdrop-blur text-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground"
        aria-label="Hide share panel"
        title="Hide"
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 font-medium text-foreground mb-2">
        <Globe className="h-4 w-4 shrink-0" />
        Share (internet)
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        Quick Cloudflare tunnel — players open this link (invite code still required to register).
      </p>
      {url ? (
        <div className="space-y-2">
          <div className="break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">{url}</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={() => void copy()}>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => void stop()}>
              <Square className="h-3.5 w-3.5" />
              Stop
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" className="gap-1.5" disabled={starting} onClick={() => void start()}>
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {starting ? "Starting…" : "Start share link"}
        </Button>
      )}
    </div>
  );
}
