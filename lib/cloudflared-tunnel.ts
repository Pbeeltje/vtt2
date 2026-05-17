import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { tunnelRuntime } from "./tunnel-state";
import { resolveCloudflaredExecutable } from "./resolve-cloudflared";

const TRY_CLOUDFLARE_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi;

function reset() {
  tunnelRuntime.publicUrl = null;
  tunnelRuntime.proc = null;
  tunnelRuntime.startPromise = null;
}

function tryParseUrl(buffer: string): string | null {
  const matches = buffer.match(TRY_CLOUDFLARE_RE);
  if (!matches?.length) return null;
  return matches[matches.length - 1] ?? null;
}

export function stopCloudflaredTunnel(): void {
  if (tunnelRuntime.proc && !tunnelRuntime.proc.killed) {
    try {
      tunnelRuntime.proc.kill();
    } catch {
      /* ignore */
    }
  }
  reset();
}

/**
 * Spawns `cloudflared tunnel --url http://127.0.0.1:<port>` and resolves when the public URL appears in output.
 */
export function startCloudflaredTunnel(localPort: number, timeoutMs = 60_000): Promise<string> {
  if (tunnelRuntime.publicUrl && tunnelRuntime.proc && !tunnelRuntime.proc.killed) {
    return Promise.resolve(tunnelRuntime.publicUrl);
  }
  if (tunnelRuntime.startPromise) {
    return tunnelRuntime.startPromise;
  }

  tunnelRuntime.startPromise = new Promise<string>((resolve, reject) => {
    let settled = false;
    let buf = "";

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      stopCloudflaredTunnel();
      reject(err);
    };

    const ok = (url: string) => {
      if (settled) return;
      settled = true;
      tunnelRuntime.publicUrl = url;
      tunnelRuntime.startPromise = null;
      resolve(url);
    };

    const timer = setTimeout(() => {
      fail(
        new Error(
          "Timed out waiting for tunnel URL. Install cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/) and ensure it is on PATH."
        )
      );
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      const url = tryParseUrl(buf);
      if (url) {
        clearTimeout(timer);
        ok(url);
      }
    };

    const cloudflaredExe = resolveCloudflaredExecutable();
    if (!cloudflaredExe) {
      clearTimeout(timer);
      tunnelRuntime.startPromise = null;
      reject(
        new Error(
          "cloudflared not found. Add its folder to user PATH, or set CLOUDFLARED_PATH (full path to cloudflared.exe) or CLOUDFLARED (folder) in .env.local — then restart the dev server."
        )
      );
      return;
    }

    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(cloudflaredExe, ["tunnel", "--url", `http://127.0.0.1:${localPort}`], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
        windowsHide: true,
        shell: false,
      });
    } catch (e) {
      clearTimeout(timer);
      tunnelRuntime.startPromise = null;
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }

    tunnelRuntime.proc = child;

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);

    child.on("error", (err) => {
      clearTimeout(timer);
      fail(
        err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT"
          ? new Error(
              "cloudflared failed to start (ENOENT). Check CLOUDFLARED_PATH / CLOUDFLARED in .env.local or PATH. https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
            )
          : err instanceof Error
            ? err
            : new Error(String(err))
      );
    });

    child.on("close", (code) => {
      if (!settled) {
        clearTimeout(timer);
        fail(new Error(`cloudflared exited before a URL was ready (code ${code ?? "unknown"}).`));
        return;
      }
      if (tunnelRuntime.proc === child) {
        tunnelRuntime.proc = null;
        tunnelRuntime.publicUrl = null;
      }
    });
  });

  return tunnelRuntime.startPromise;
}
