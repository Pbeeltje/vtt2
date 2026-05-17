/**
 * Waits until the VTT HTTP server answers, then runs cloudflared quick tunnel.
 * Used by: npm run dev:share
 */
import http from "http";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { spawn, execSync } from "child_process";

try {
  const require = createRequire(import.meta.url);
  require("dotenv").config({ path: path.join(process.cwd(), ".env.local") });
  require("dotenv").config({ path: path.join(process.cwd(), ".env") });
} catch {
  /* dotenv missing or unreadable */
}

const port = process.env.PORT || "3000";
const target = `http://127.0.0.1:${port}`;

function findCloudflaredExeUnder(dir, maxDepth, depth = 0) {
  if (depth > maxDepth) return null;
  const direct = path.join(dir, "cloudflared.exe");
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

function findCloudflaredInWingetPackages() {
  const la = process.env.LOCALAPPDATA;
  if (!la) return null;
  const pkgRoot = path.join(la, "Microsoft", "WinGet", "Packages");
  try {
    const entries = fs.readdirSync(pkgRoot, { withFileTypes: true });
    for (const d of entries) {
      if (!d.isDirectory()) continue;
      const name = d.name.toLowerCase();
      if (!name.includes("cloudflared")) continue;
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

function windowsCloudflaredCandidates() {
  const out = [];
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

function resolveCloudflaredExecutable() {
  const envPath = process.env.CLOUDFLARED_PATH?.trim();
  if (envPath && fs.existsSync(envPath)) return envPath;

  const folderEnv = process.env.CLOUDFLARED?.trim();
  if (folderEnv) {
    const joined = path.join(folderEnv, process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
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

function printCloudflaredMissingHelp() {
  // eslint-disable-next-line no-console
  console.error(`
[tunnel] Could not find cloudflared.exe (winget often installs it without updating PATH).

[tunnel] Fixes:
[tunnel]   1) New terminal / reboot (sometimes PATH is updated for the next session)
[tunnel]   2) Set full path once in .env.local:
[tunnel]      CLOUDFLARED_PATH=C:\\\\path\\\\to\\\\cloudflared.exe
[tunnel]   3) Add the folder that contains cloudflared.exe to your user PATH (Settings → Environment variables)

[tunnel] Install / docs:
[tunnel]   winget install --id Cloudflare.cloudflared
[tunnel]   https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
`);
}

const cloudflaredExe = resolveCloudflaredExecutable();
if (!cloudflaredExe) {
  printCloudflaredMissingHelp();
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(`[tunnel] Using: ${cloudflaredExe}`);

function serverIsUp() {
  return new Promise((resolve) => {
    const req = http.get(`${target}/`, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2500, () => {
      try {
        req.destroy();
      } catch {
        /* ignore */
      }
      resolve(false);
    });
  });
}

// eslint-disable-next-line no-console
console.log(`[tunnel] Waiting for app at ${target} …`);

for (;;) {
  if (await serverIsUp()) break;
  await new Promise((r) => setTimeout(r, 400));
}

// eslint-disable-next-line no-console
console.log(
  `[tunnel] Starting cloudflared → ${target}\n[tunnel] When you see https://….trycloudflare.com below, that is the link to share.\n`
);

const child = spawn(cloudflaredExe, ["tunnel", "--url", target], {
  stdio: "inherit",
  env: process.env,
  shell: false,
});

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
