# Running and project status

Operational detail that the source does not show on its own. The backend and frontend
are separate npm projects; a thin root `package.json` ties them together so the usual
commands work from one place.

## Development

```bash
npm run setup
npm run dev
```

`npm run dev` runs [`scripts/dev.mjs`](./scripts/dev.mjs), which installs any missing
dependencies from the checked-in lockfiles, starts both dev servers, prefixes their
logs, and stops both when either exits or you press `Ctrl+C`. It is plain Node with no
dependencies, so it behaves the same in PowerShell, cmd and Bash; on Windows it tears
down the child process trees with `taskkill`. `./start.sh` is a wrapper around the same
script.

Open <http://localhost:5173>. Vite proxies `/api` and `/socket.io` to the backend on
port 3001.

## Production

```bash
npm start        # build both, then serve everything from one process on :3001
npm run serve    # same, without rebuilding
```

In production the backend serves the built dashboard itself, with hashed assets marked
immutable, `index.html` marked `no-cache`, and a single-page-app fallback for client
routes. `/api/*` paths that do not match a route return a JSON 404 rather than the app
shell.

`docker compose up --build` does the same inside one container. The image builds both
projects and keeps the OpenF1 cache on a named volume.

## Commands

From the repository root:

| Command | What it does |
| --- | --- |
| `npm run setup` | Install both projects from their lockfiles |
| `npm run dev` | Both dev servers, together |
| `npm start` | Build, then serve everything on port 3001 |
| `npm run serve` | Serve an existing build |
| `npm run build` | Compile the backend and build the frontend |
| `npm test` | 69 tests across both projects |
| `npm run typecheck` | Type-check both projects, tests included |
| `npm run check` | Type-check, test and build — what CI runs |
| `npm run verify` | Report which fields OpenF1 is currently returning |
| `npm run prefetch` | Build circuit geometry for every known circuit |

## Configuration

[`backend/.env.example`](./backend/.env.example) documents every setting, and
[`backend/src/config/index.ts`](./backend/src/config/index.ts) validates them at startup
with a clear error and a non-zero exit if anything is wrong. All settings have defaults,
so `backend/.env` is optional. The frontend needs no environment file.

OpenF1 credentials are only ever read server-side. Do not put them in a frontend
variable or commit a populated `.env`.

## Operating notes

- **First load is slow.** A race that is not in the cache is downloaded a window at a
  time at the configured request rate, which takes a few minutes. The dashboard shows
  progress while this happens. Cached responses live in `backend/.cache/openf1`.
- **The server listens before the race is loaded.** It does not wait on OpenF1 to come
  up, so `GET /api/health` is always available to say what is happening: `loading` with
  a percentage, `ok`, or `error` with a message and a 503.
- **A load failure is visible in the UI**, not just the log — the dashboard shows the
  backend's message instead of an spinner that never ends.
- **Deleting the cache is safe**; it only costs another download.

## Known limitations

- Only replay is implemented. `DATA_PROVIDER=live` enables OpenF1 token authentication
  but there is no live MQTT provider, so live race streaming is not available.
- `inPit` and `retired` are always false on the leaderboard. OpenF1 exposes enough to
  derive them, but the engine does not yet.
- `npm run prefetch` writes circuit geometry under `frontend/src/assets/tracks/`, but
  nothing reads it yet; the frontend takes its geometry from the backend at runtime.
- `f1_visualizer.html` at the repository root is an earlier standalone prototype that
  runs on simulated data. It is not part of the application and nothing references it.
- DRS zones depend on `drs` readings that OpenF1 does not publish for every session.
  When they are missing the backend logs a warning and the map simply has no DRS
  shading.
- There is no end-to-end browser test; the suites cover the backend engine and the
  frontend's pure logic.

The project is an unofficial OpenF1-based visualizer and is not affiliated with or
endorsed by Formula 1, FOM, the FIA, or any team.
