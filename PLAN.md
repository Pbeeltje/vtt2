# VTT Plan: from audit to The Job System

This VTT exists to run **The Job System**, a homebrew TTRPG whose rules live in Notion
(page "The Job System" under "Shared Bits"). This plan comes from a full audit in October 2026
and replaces the Cursor-generated `TASKS.md` and `SECURITY_FIXES.md`. Those files claim work
that was never done (rate limiting, CSRF, RBAC, session timeouts) and list features that already exist.

Work happens in phases. Each phase should leave the app working and playable.

| Phase | Goal | Status |
|---|---|---|
| 0 | Lock down security and stop data loss | **Done** (uncommitted when written) |
| 1 | Foundation: DB, sync, dice, bugs, repo hygiene | Next |
| 2 | Job System data model | After 1 |
| 3 | Rules helpers (roll + DM confirm) | After 2 |
| 4 | Extras | Later |

---

## Rules decisions (where Notion is unclear)

The owner settled these. They override the Notion text.

- **Attributes:** STR, DEX, MND, CHA are rolled 2d6+4 in order. The DB column `Dexternity` is a typo for DEX.
- **Skill** is not rolled. It starts at 10 and warriors gain +1 per level, to a maximum of 19.
- **Spellcraft was cut.** Remove it from the sheet (today `StatsTab.tsx` shows "Spellcraft" for magic users).
- **Levelling:** start at level 1 with one job at tier 1. Gaining a new job, or a higher tier in an existing job, also gives +1 level. There is **no XP**.
- **Guard** is rolled once at creation (d6 warrior, d4 magic user) and the roll is stored. At **level 4** (the only reroll level for now), reroll: keep the new result if higher, otherwise old value +1.
  - Max Guard = Guard roll, +2 at DEX 18, +2 when carrying only light items, plus job effects.
  - Exposed treats Guard as 0. "Danger passed" restores current Guard to max.
- **Corruption** starts at **d12** per magic colour (the Paths page says d20; ignore that). It shrinks d12 → d10 → d8 → d6 → d4. Keep the starting size as a single setting.
- **CON was removed.** Anything that used CON (the poison table) now uses STR. **AGI** in the corruption tables means **DEX**.
- **Automation level:** roll helpers plus damage the DM confirms. No rules engine that decides outcomes ("fiction over rules").

Open questions:
- Do magic users have a Skill score at all (fixed 10?) or none now that Spellcraft is cut?
- The Race page in Notion hasn't been reviewed yet for VTT needs.

---

## Phase 0: done

**What changed**
- **Login and sessions**
  - The `user` cookie is now HMAC-signed (`lib/session-token.ts`) with a 7-day server-side expiry.
  - The role is re-read from the DB on every request (`lib/auth.ts`), so demotions apply immediately.
  - `lib/auth.ts` is no longer a `"use server"` module. The only browser-callable action is `loginUser` in `lib/auth-actions.ts`.
  - The password-less "Login as DM (Test)" button and `loginDM()` are removed. The env DM (`DM_USERNAME`/`DM_PASSWORD`, user id 0) now logs in on the normal form.
  - The `ALLOW_TEST_LOGIN` bypass is gone. `/api/login` shares the same checks and no longer queries the non-existent `User.id` column.
- **Rate limiting:** in-memory, in `lib/rate-limit.ts`, on login, register and invite checks. The invite code is compared in constant time.
- **XSS**
  - Chat (`RightSideMenu`, `MiniChat`) and the notes ticker (`BottomBar`) render text, not HTML. Old `<strong>`/`<br>` formatting is stripped (`lib/chat-text.ts`).
  - Ticker colours must be hex.
  - Chat fields have length limits.
- **Uploads**
  - The type is detected from file bytes (PNG/JPEG/GIF/WebP only) and the extension is forced to match.
  - `/uploads/*` is served with `nosniff` and a sandbox CSP (`next.config.mjs`).
- **Real-time updates**
  - `lib/socket.ts` used `Symbol(...)` as its global key. API route bundles got a different symbol, so every server→client emit failed: chat, scenes, characters and notes never arrived live. It now uses a string key.
  - Scene events now have one payload shape (`lib/scene-sync.ts`). Player token moves used to send a different shape that wiped both map layers on every client.
  - The sender of a scene change is excluded via an `X-Socket-Id` header, so the DM's autosave no longer echoes back mid-drag.
- **Side effects of live updates fixed**
  - The character sheet merges server updates without wiping fields being edited (`useCharacter.ts`).
  - The "New Character Assigned" toast used a stale list, so it fired on every save.
  - The BottomBar notes listener was never removed.
- **Authorization**
  - Player token place/move/delete checks ownership in the DB, not the client-sent `userId`.
  - Bulk inventory updates only touch items the character owns.
  - Only the host can reset a DM's password.
  - Notes GET requires login.
- **Error details** (`details: error.message`) are no longer returned to clients.
- **`.env.example`** was updated and un-ignored.
- **Leaked credentials:** the repo was public, and the env DM login had been the hardcoded test pair, which was visible in the code.
  - `DM_USERNAME`, `DM_PASSWORD` and `SECRET_COOKIE_PASSWORD` were rotated (in `.env.local`, not in git).
  - The files that still contained the test login were deleted: `test-*.js` and `repomix-output.txt`.
  - User uploads are no longer tracked (`public/uploads/` is ignored; the files stay on disk).
  - Git history still contains the old test login, uploaded images, and a 2025 copy of the DB with bcrypt password hashes for the player accounts. Rewriting history (`git filter-repo` plus a force push) is optional and only useful alongside the rotation already done.

**How it was verified:** 28 end-to-end checks plus a cross-player tampering test passed against a copy of the app and DB. They covered forged/bad-signature cookies, DB role lookup, rate limit, notes auth, live chat delivery, scene payload shape, no self-echo, guest sockets excluded, token ownership, and upload rejection and headers. The typecheck still shows exactly the 28 pre-existing errors and no new ones. The UI was not clicked through in a browser.

**Effects for users**
- Everyone is logged out once, because old cookies are rejected.
- `SECRET_COOKIE_PASSWORD` must be set. It is accepted at 16+ characters; 32+ is recommended. In production the server refuses to start without it.

---

## Phase 1: foundation

Do these roughly in order. File references are from the audit and may drift.

### 1.1 Database: one module and real migrations
- [ ] **Create one DB module** (e.g. `lib/db.ts`) exporting a single libsql client.
  - Its path comes from `DATABASE_PATH`, defaulting to `<project root>/vttdatabase.db`. Today about 20 files each call `createClient("file:./vttdatabase.db")`, which depends on the working directory.
  - Move the 6 better-sqlite3 users (`app/lib/db.ts`: notes, journal-notes, drawings and others) onto it, then delete `app/lib/db.ts`.
  - Enable WAL and foreign keys in one place.
- [ ] **Add a migrations runner**: `migrations/NNN_name.sql`, tracked with `PRAGMA user_version`, run from `server.ts` before `listen`.
  - Migration 001 = the current live schema. That is `vttdatabase.db.sql` plus `User.IsHostAdmin` and `journal_note`; the .sql file has drifted.
  - Fold in and then delete the ad-hoc schema code: the `ALTER` in `lib/user-schema.ts`, the `CREATE TABLE` in `app/lib/db.ts`, `add-color-column.js`, `migrate-dmimage.js`, `update-token-to-prop.js`.
- [ ] **Make a fresh clone start with a working empty DB** and a way to create the first DM. Document it in the README.
- [ ] **Leave `hex`/`hexmap` alone** (1,281 rows, unused). They may become the overland map in Phase 4.
- [ ] **Remove the "first DM to load /api/users becomes host" race** (`crownHostAdminIfNone`). The host should be set explicitly, by migration or by env DM id 0.

### 1.2 Real-time sync and scene state
- [ ] **Debounce the scene autosave** (`Home.tsx` save effect, around line 1055) to roughly 300–500 ms, and save on drag end rather than on every `onDrag`, resize or fog-cell tick.
- [ ] **Fix the stale-state saves:**
  - `handleGridColorChangeAndSave` and `handleClearSceneElements` save the old values. Save from the new state.
  - Add `gridSize` to the save effect's dependencies.
- [ ] **Replace the single `isSocketUpdateRef` flag** and its `setTimeout(0)` dance with something robust: compare against the last-saved version, or apply remote updates without triggering a save.
- [ ] **Fix lost updates:** the DM's full-scene autosave can overwrite a player's token move. Add a `version` to SceneData with optimistic concurrency, or move tokens to their own table.
- [ ] **Persist the active scene** (`/api/scenes/set-active` only broadcasts). On reload, players should load the active scene, not the most recently saved one, which may be a scene the DM is still preparing.
- [ ] **Send fog live:** include `darknessPaths`, `isDarknessLayerVisible` and `borderSize` in `sceneUpdatePayload` (`lib/scene-sync.ts`) and apply them in the `scene_updated` handler.
- [ ] **Stop over-sharing with players:**
  - `GET /api/scenes` sends every scene, fog included, to players. Send players only the active scene.
  - `character_updated` sends every character (NPCs and monsters too) to every client. Send to DMs and the owner only, using per-user rooms such as `user:<id>`.
- [ ] **Scene scale/border dialog edits the loaded scene,** not the one picked (`Home.tsx` ~1059–1096, `ImageList.tsx` ~168). Rescaled drawings are never saved.
- [ ] **Handle `character_deleted` on clients** (it is emitted, but nothing listens).
- [ ] **Stale token stats:** tokens store a stats snapshot that is never refreshed. Short term, refresh on `character_updated`. Phase 2 removes the snapshot.

### 1.3 Server-side dice and chat trust
- [ ] **Add `POST /api/roll`** with a dice expression (`3d6`, `d20`, `2d8kh1`). The server rolls and posts a `diceRoll` chat message with structured results (store JSON, render text). Replace the browser roller in `BottomBar.tsx`. Phase 3 builds on this.
- [ ] **Validate the chat speaker** on the server: it must be the user's own name or one of their characters' names (the DM may use any). Today `speakerName` and `senderType` are trusted from the client.
- [ ] **Paginate chat history.** `GET /api/chat` returns every message ever.

### 1.4 Known bugs
- [ ] **Deleting a character always fails**: `SELECT InventoryId FROM Character`, a column that doesn't exist (`characters/[id]/route.ts` ~184).
- [ ] **Creating a character:** the UI handler `handleAddCharacter` is empty (`Home.tsx`). `POST /api/characters` always fails: `INSERT INTO inventory DEFAULT VALUES` violates NOT NULL.
- [ ] **Bulk inventory PUT always fails**: `ON CONFLICT(CharacterId, ItemId)` has no unique index. Fix it, or drop it in favour of the Phase 2 inventory model.
- [ ] **`GET /api/characters` writes placeholder inventory rows** on every read.
- [ ] **Image rename always returns 404** (checks `rows.length` on an UPDATE without RETURNING).
- [ ] **Image delete:** runs manual `BEGIN/COMMIT` on a shared client and deletes the file before committing. Also, images PUT/DELETE still filter by `UserId`.
- [ ] **Login is case-sensitive but registration lowercases.** Make login `COLLATE NOCASE`.
- [ ] **Jobs:** add a DELETE endpoint and button; validate PUT input (an undefined tier gives a 500).
- [ ] **Keyboard shortcuts fire while typing**: Delete in chat deletes tokens, and Delete in the ticker input clears all notes. Ignore key events from inputs (`MainContent.tsx` ~695–798, `BottomBar.tsx`).
- [ ] **Arrow-key nudge does nothing**: `updateItemPosition` ignores its `id` (`useMainContent.ts` ~149).
- [ ] **`useDragAndDrop.ts:333/348`**: a local `draggedItem` shadows the ref. It writes `.current` onto a token, or throws when it is null.
- [ ] **`TokenSettingsModal`** initializes state once from `token=null`, so saving resets scale and aura. Scale then aura updates also overwrite each other (`MainContent.tsx` ~478–505).
- [ ] **`handleStatusUpdate` replaces `token.character`** with a partial object without `userId` or `CharacterId`, so the player loses control of their token (`MainContent.tsx` ~410).
- [ ] **Token/portrait upload in `StatsTab`** only updates local state until another field blurs.
- [ ] **Ctrl+wheel zoom also zooms the browser** (React `onWheel` is passive). Zoom isn't anchored on the cursor.
- [ ] **Text balloons over tokens** only show for the sender.
- [ ] **Logged-out users see the map and toolbar** behind the login box.

### 1.5 Code structure
- [ ] **Split `Home.tsx` (~1,500 lines)** into `useSocket`, `useSceneState` (owns the debounced save), `useChat`, `useCharacters`, plus an API client module.
- [ ] **Split `MainContent.tsx` (~1,100 lines)** in the same way.
- [ ] **Deduplicate:**
  - `ChatMessage` type (3×) and its mapping block (5×)
  - the chat UI (RightSideMenu vs MiniChat)
  - the token snapshot builder (CharacterList and useDragAndDrop)
  - the character PUT (5 places)
  - the duplicate logout call
- [ ] **Add `React.memo`** where every drag tick re-renders the whole tree, including the chat history.

### 1.6 Repo hygiene
- [x] **Stop tracking uploaded images** (done in Phase 0).
- [ ] **Delete:**
  - `v0-user-next.config.js` (and the merge code in `next.config.mjs`), the empty `.cursor/rules/dbrule.mdc`
  - `lib/session.ts` and `iron-session`
  - the root `check-*.js`, `add-*.js`, `migrate-*.js` and `update-*.js` scripts (after 1.1)
  - (`repomix-output.txt` and the `test-*.js` scripts were already deleted in Phase 0.)
- [ ] **Delete or rewrite `TASKS.md` and `SECURITY_FIXES.md`** so they point here.
- [ ] **`package.json`:**
  - Rename it from `my-v0-project`.
  - Move `socket.io` and `cross-env` into `dependencies`; they're needed at runtime.
  - Pin the `latest` versions and remove the duplicate `@types/react*`.
  - Remove unused deps: `zod`, `@hookform/resolvers`, `ts-node`, `@swc/core`, `recharts`, `embla-carousel-react`, `react-day-picker`, `cmdk`, `vaul`, `input-otp`, `react-resizable-panels`, `react-hook-form`, `next-themes`, `sonner`, and most `@radix-ui/*`.
  - Delete the ~33 unused `components/ui/*` files, the duplicate `hooks/`, `app/components/ui/button.tsx`/`popover.tsx`, and `styles/globals.css`.
- [ ] **Type errors:**
  - Update the 8 dynamic route handlers to Next 15's async `params`.
  - Fix the other 4 errors: `Home.tsx` `onRegister`, `MainContent.tsx` `onUpdateColor`, `cloudflared-tunnel.ts`, and the unused `calendar.tsx`.
  - Then remove `typescript.ignoreBuildErrors` and add eslint (or remove the broken `lint` script).
- [ ] **Dev tooling:**
  - nodemon doesn't recompile `server.ts`/`lib/socket.ts` on change.
  - `.vscode/launch.json` uses https, but the server is http.
- [ ] **Write a README** covering setup, env, first DM, LAN, tunnel and scripts.

### 1.7 Tests
- [ ] **Add a test runner** (e.g. vitest) with a temp-DB setup, plus integration tests for auth, scene sync and token ownership. The Phase 0 checks are a good starting set: sign a cookie with the test secret, connect socket.io clients, assert on events.
- [ ] **Optional: CI** running typecheck and tests.

---

## Phase 2: Job System data model

| Concept | Today | Target |
|---|---|---|
| Attributes | Fixed columns, `Dexternity` | STR/DEX/MND/CHA current/max (rename to DEX) |
| Skill | Column, "Spellcraft" for magic users | Warriors: 10 + 1 per level, max 19. Spellcraft removed |
| Path | Free text | Warrior / Magic User. Sets Guard die, MP growth (2 + 1 per level), allowed jobs |
| Level | Hand-edited number | Derived from job gains (one level per new job or tier) |
| Guard | Number | Guard history (die, creation roll, rerolls with level), Max Guard derived, current Guard separate |
| Jobs | Free-text name/tier per character | **Job catalog** (category: Warrior/Magic/Ecclesiastic/General/Cursed; path restriction; requirements like STR 15+; tiers with name, abilities, stat boosts) + `character_job` (job, tier, training season) |
| Items | One-off rows, 16 fixed slots | **Item catalog** (slots, damage dice, traits simple/long/hefty/heavy/reload, armor, cost) + inventory rows (slot tier light/moderate/encumbered, quantity: ammo 10/slot, coins 100/slot), purse (20 weightless), heavy items |
| Armor | Number | Derived from equipped items |
| Magic | MP fields | Known spells/arcana (MP cost, speed Quick/normal/slow), corruption die per colour (Gray, Black, Green, White, Turquoise, Spheres) |
| State | — | Conditions (Exposed, Prone, Blind, Deprived, Encumbered, Mortally Wounded) and injuries |
| Tokens | Stats snapshot in scene JSON | `characterId` only; stats read live |
| NPCs | Same as PCs | Monster stat block, Morale (1–20), size (Small–Huge) |

- **Level-up flow:** gaining a job or tier triggers +1 level, Skill +1 (warriors), MP +1 (magic users), and the Guard reroll prompt at level 4.
- **Seed the catalogs from Notion** once, into JSON in the repo (e.g. `data/jobsystem/*.json`): the Weapons table, the Warrior/Magic User/... Jobs pages, corruption tables, Conditions, Armor. Don't read Notion live.

## Phase 3: rules helpers (roll + DM confirm)

All of these use the Phase 1 server-side roller.

1. **Tests:** click an attribute to roll d20 ≤ score; 1 always passes, 20 always fails. Optionally show the partial-success band (±5). Also add a Luck roll (d6), System Shock (d100 ≤ 82 + STR), and Attribute Challenges that total an attribute across selected tokens.
2. **Attacks:** roll the weapon dice and keep the highest.
   - Impaired: a single d4. Enhanced: add a bonus die and keep the highest.
   - Gambit prompts: dice of 4+ can be spent; 8+ in melee makes a Strong Gambit.
   - Parry is opposed attack dice; a shield counts as d10.
3. **Damage:** show the armor → Guard → STR breakdown. Warn on Mortally Wounded (lost more than half the remaining STR) and on Slain (STR 0). Nothing changes until the DM confirms.
4. **PQAR tracker:** replaces the local-only `EncounterButton`, synced to all clients.
   - In Prep, everyone declares an action as Quick, Act or Release.
   - Sides roll opposed d6 for initiative.
   - The DM steps through the phases. Spellcasters hit before their spell goes off are flagged.
5. **Spellcasting:** MP spend or spell-burn (2 MND per MP). Spending 3+ MP or spell-burning triggers a corruption roll; a 1–2 shrinks the die and looks up that colour's table.
6. **Encumbrance:** wire the existing tiers in `InventoryTab.tsx`. Light-only gives +2 Guard; anything in the encumbered tier applies Exposed.
7. **Rest buttons:** "Danger passed" restores Guard. Rest restores +1 per damaged attribute (+2 with hospitality) and refills MP; Deprived blocks it. A watch/turn/season clock supports job training (one season per tier).
8. **Range bands:** a measuring tool showing melee 1 m, reach 2 m, mid 2–10 m, long 10–20 m, very long 20–90 m. Needs a meters-per-cell setting.
9. **Character creation wizard:** roll 2d6+4 in order, race, path (rolls Guard), tier-1 job (roll or pick), starting goods (1 weapon + 2 items).

## Phase 4: later
- Rules reference panel
- Followers and hirelings with loyalty
- Warbands
- Overland travel (revive `hex`/`hexmap`?)
- Domain play
- Touch/mobile support and accessibility: modals with Esc and focus trap, aria labels
