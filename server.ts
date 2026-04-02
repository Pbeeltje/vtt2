// server.ts
// Next's programmatic `next()` + `prepare()` does not pass the HTTP `server` into
// `getRequestHandlers()`, unlike `next dev`. Without it, dev middleware never serves
// `/_next/static/chunks/*` → 404 on main-app.js, app-pages-internals.js, etc.
// See: next/dist/server/next.js (NextCustomServer.prepare) vs start-server.js (startServer).

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { parse } from 'url';
import path from 'path';
import os from 'os';
import { formatUrl } from 'next/dist/shared/lib/router/utils/format-url';
import { initSocketIO } from './lib/socket';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getRequestHandlers } = require('next/dist/server/lib/start-server') as {
  getRequestHandlers: (opts: {
    dir: string;
    port: number;
    isDev: boolean;
    hostname: string;
    server: ReturnType<typeof createServer>;
    minimalMode?: boolean;
    quiet?: boolean;
    onDevServerCleanup?: (cb: () => Promise<void>) => void;
    keepAliveTimeout?: number;
    experimentalHttpsServer?: boolean;
  }) => Promise<{
    requestHandler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
    upgradeHandler: (
      req: IncomingMessage,
      socket: unknown,
      head: Buffer
    ) => Promise<void>;
  }>;
};

function getProjectRoot(): string {
  // npm run dev compiles here: .next/server_custom_build/server.js
  if (path.basename(__dirname) === 'server_custom_build') {
    return path.resolve(__dirname, '..', '..');
  }
  return path.resolve(__dirname);
}

function nonLoopbackIpv4s(): string[] {
  const nets = os.networkInterfaces();
  const out: string[] = [];
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        out.push(net.address);
      }
    }
  }
  return out;
}

const dev = process.env.NODE_ENV !== 'production';
/** TCP bind address. Default all interfaces so LAN players can connect without extra env. */
const listenHost = process.env.LISTEN_HOST ?? '0.0.0.0';
/** Next dev server hostname (HMR / dev origin checks). Keep localhost unless you know you need otherwise. */
const nextDevHostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const projectRoot = getProjectRoot();

function createOnDevServerCleanup(): ((cb: () => Promise<void>) => void) | undefined {
  if (!dev) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AsyncCallbackSet } = require('next/dist/server/lib/async-callback-set') as {
    AsyncCallbackSet: new () => { add: (cb: () => Promise<void>) => void };
  };
  const cleanupListeners = new AsyncCallbackSet();
  return cleanupListeners.add.bind(cleanupListeners);
}

async function main(): Promise<void> {
  const httpServer = createServer();

  const initResult = await getRequestHandlers({
    dir: projectRoot,
    port,
    isDev: dev,
    hostname: nextDevHostname,
    server: httpServer,
    minimalMode: false,
    quiet: false,
    onDevServerCleanup: createOnDevServerCleanup(),
  });

  const { requestHandler, upgradeHandler } = initResult;

  httpServer.on('request', (req, res) => {
    const parsedUrl = parse(req.url || '', true);
    req.url = formatUrl(parsedUrl);
    void requestHandler(req, res);
  });

  httpServer.on('upgrade', (req, socket, head) => {
    void upgradeHandler(req, socket, head);
  });

  initSocketIO(httpServer);

  httpServer.listen(port, listenHost, () => {
    console.log(`> This machine:  http://localhost:${port}`);
    if (dev) {
      console.log(
        '> Internet (dev): in a second terminal run  npm run tunnel:cloudflare  (install cloudflared once) or  npm run tunnel:ngrok'
      );
      console.log(
        '> Custom tunnel domain? Add it to .env.local: ALLOWED_DEV_ORIGINS=your-subdomain.example.com  (comma-separated)'
      );
    }
    if (listenHost === '0.0.0.0' || listenHost === '::') {
      const addrs = nonLoopbackIpv4s();
      if (addrs.length > 0) {
        for (const ip of addrs) {
          console.log(`> LAN (optional):    http://${ip}:${port}`);
        }
      }
      console.log(`> Loopback-only:      set LISTEN_HOST=127.0.0.1`);
    }
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    console.error('Server error:', err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
