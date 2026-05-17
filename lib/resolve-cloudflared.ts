import fs from "fs";
import path from "path";
import { execSync } from "child_process";

function findCloudflaredExeUnder(dir: string, maxDepth: number, depth = 0): string | null {
  if (depth > maxDepth) return null;
  const direct = path.join(dir, process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
  if (fs.existsSync(direct)) return direct;
  try {
    const names = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of names) {
      if (!ent.isDirectory()) continue;
      const found = findCloudflaredExeUnder(path.join(dir, ent.name), maxDepth, depth + 1);
      if (found) return found;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function findCloudflaredInWingetPackages(): string | null {
  const la = process.env.LOCALAPPDATA;
  if (!la) return null;
  const pkgRoot = path.join(la, "Microsoft", "WinGet", "Packages");
  try {
    const entries = fs.readdirSync(pkgRoot, { withFileTypes: true });
    for (const d of entries) {
      if (!d.isDirectory()) continue;
      if (!d.name.toLowerCase().includes("cloudflared")) continue;
      const pkgDir = path.join(pkgRoot, d.name);
      const exe = path.join(pkgDir, "cloudflared.exe");
      if (fs.existsSync(exe)) return exe;
      const nested = findCloudflaredExeUnder(pkgDir, 4);
      if (nested) return nested;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function windowsCloudflaredCandidates(): string[] {
  const out: string[] = [];
  const pf = process.env.ProgramFiles;
  const pfx86 = process.env["ProgramFiles(x86)"];
  const la = process.env.LOCALAPPDATA;
  if (pf) out.push(path.join(pf, "cloudflared", "cloudflared.exe"));
  if (pfx86) out.push(path.join(pfx86, "cloudflared", "cloudflared.exe"));
  if (la) {
    out.push(path.join(la, "cloudflared", "cloudflared.exe"));
    out.push(path.join(la, "Microsoft", "WinGet", "Links", "cloudflared.exe"));
    out.push(path.join(la, "Programs", "cloudflared", "cloudflared.exe"));
  }
  return out;
}

/**
 * Full path to cloudflared executable, or null.
 * Supports CLOUDFLARED_PATH (path to .exe), CLOUDFLARED (folder containing exe), PATH, WinGet install dirs.
 */
export function resolveCloudflaredExecutable(): string | null {
  const pathEnv = process.env.CLOUDFLARED_PATH?.trim();
  if (pathEnv && fs.existsSync(pathEnv)) return pathEnv;

  const folderEnv = process.env.CLOUDFLARED?.trim();
  if (folderEnv) {
    const exeName = process.platform === "win32" ? "cloudflared.exe" : "cloudflared";
    const joined = path.join(folderEnv, exeName);
    if (fs.existsSync(joined)) return joined;
  }

  try {
    if (process.platform === "win32") {
      const out = execSync("where.exe cloudflared", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const line = out.trim().split(/\r?\n/)[0]?.trim();
      if (line && fs.existsSync(line)) return line;
    } else {
      const out = execSync("which cloudflared", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const line = out.trim();
      if (line) return line;
    }
  } catch {
    /* fall through */
  }

  if (process.platform === "win32") {
    for (const p of windowsCloudflaredCandidates()) {
      if (fs.existsSync(p)) return p;
    }
    const winget = findCloudflaredInWingetPackages();
    if (winget) return winget;
  }

  return null;
}
