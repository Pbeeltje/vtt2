# Job System VTT

A virtual tabletop for **The Job System**, a homebrew TTRPG. Next.js 15 (App Router) with a custom
Node server for Socket.IO, and SQLite through libsql. The roadmap is in [PLAN.md](PLAN.md).

## Setup

Requires Node 22.12+.

```bash
npm install
cp .env.example .env.local   # then fill it in (see below)
npm run dev                  # http://localhost:3000
```

On the first start the server creates `vttdatabase.db` (or `DATABASE_PATH`) and applies the
migrations in `migrations/`. An existing database is upgraded in place.

## The first DM (host)

Set `DM_USERNAME` and `DM_PASSWORD` in `.env.local`. That account is user 0 and the permanent
**host**: it logs in with the env password (never stored in the DB), can make other accounts DM,
and is the only one who can reset a DM's password. Players register on the login screen
(with `REGISTRATION_SECRET` as invite code, if set).

## Environment

| Variable | Needed | Meaning |
|---|---|---|
| `SECRET_COOKIE_PASSWORD` | yes (prod) | Signs session cookies. 32+ random characters. |
| `DM_USERNAME`, `DM_PASSWORD` | yes | The host DM account. |
| `REGISTRATION_SECRET` | no | Invite code required to register. |
| `DATABASE_PATH` | no | SQLite file; default `vttdatabase.db` in the project root. |
| `PORT`, `LISTEN_HOST` | no | Default `3000` on all interfaces (LAN players can join). |
| `COOKIE_SECURE` | no | `true` forces Secure cookies. Otherwise they're Secure only over https (tunnels). |
| `ALLOWED_DEV_ORIGINS` | no | Extra hostnames for dev behind a custom tunnel domain. |
| `ENABLE_HOST_TUNNEL`, `CLOUDFLARED_PATH` | no | Let the host start a Cloudflare tunnel from the UI. |
| `TRUST_PROXY` | no | `true` trusts `X-Forwarded-*` from any address. By default only proxies on this machine (cloudflared, ngrok) are trusted. |

## Playing over the network

- **LAN:** players open `http://<your-ip>:3000` (the server prints the address).
- **Internet:** `npm run dev:share` starts the app plus a Cloudflare quick tunnel and prints the
  public URL. Or run `npm run tunnel:cloudflare` / `npm run tunnel:ngrok` next to `npm run dev`.
- **For a real session, run the production build:** `npm run session` builds, starts and tunnels
  (or `npm run build` once, then `npm run start:share`). The dev server compiles pages on first
  visit and ships unminified React, which players feel as lag. Stop `npm run dev` first: the build
  replaces `.next`.

Uploads are served by `server.ts` itself (`lib/uploads-server.ts`) with a year-long cache, and
small pictures (tokens, lists, avatars) load resized WebP copies from `/uploads/_thumbs/<size>/`,
made on first request and kept in `.cache/thumbs/`.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Dev server (restarts when `server.ts` or the socket/DB modules change). |
| `npm run build` / `npm start` | Production build / run. |
| `npm run start:share` / `npm run session` | Production server plus tunnel / build first, then that. |
| `npm test` | Vitest: unit tests plus API and Socket.IO integration tests on a temp DB. |
| `npm run typecheck` | TypeScript for the app and the custom server. |

## Code map

- `server.ts`: HTTP server, migrations, Socket.IO.
- `lib/`: server modules. `db.ts` (the one DB client), `migrate.ts`, `auth.ts`, `socket.ts`
  (rooms: scene, `user:<id>`, `role:dm`), `scene-model.ts` (scene state, merge), `scene-store.ts`
  (versioned saves), `dice.ts`, `chat.ts`.
- `app/api/`: route handlers. `app/hooks/`: client state (`useSceneState`, `useChat`, `useCharacters`, ...).
- `migrations/NNN_name.sql`: schema changes, tracked with `PRAGMA user_version`. Add a new file; never edit an applied one.
