# F1 Live Track Visualizer

An unofficial Formula 1 race replay dashboard. The Node.js backend loads a completed
race from OpenF1, derives the circuit outline from car-location samples, and streams
replay state to a responsive React dashboard over Socket.IO.

## Requirements

- Node.js 22 or newer (Node 20 reached end of life in April 2026)
- npm 10 or newer

## Run it

```bash
npm run setup
npm run dev
```

`npm run dev` starts both services and streams their logs together. Open
<http://localhost:5173>; the backend API listens on port 3001. Press `Ctrl+C` to stop
both. The launcher is plain Node, so it works the same in PowerShell, cmd and Bash;
`./start.sh` and `bash start.sh` still work and do the same thing.

The backend picks the most recent completed race unless you pin one. The first load of
a race downloads the full session from OpenF1 and can take a few minutes; responses are
cached under `backend/.cache/openf1`, so later starts are quick. Progress is shown on
the dashboard while it loads.

### As a single production process

```bash
npm start
```

This builds both projects and serves the dashboard, the REST API and the Socket.IO
stream from one process on <http://localhost:3001>. Use `npm run serve` to skip the
rebuild.

### With Docker

```bash
docker compose up --build
```

One image serves everything on <http://localhost:3001>. The OpenF1 cache lives on a
named volume, so restarting does not refetch the race.

## Configuration

Copy [`backend/.env.example`](./backend/.env.example) to `backend/.env` and edit it.
Every setting has a default, so the file is optional. The most useful one is
`REPLAY_SESSION_KEY`, which pins a specific race instead of taking the latest; the keys
come from `GET /api/sessions`. Never commit a populated environment file.

The frontend needs no configuration: in development Vite proxies `/api` and
`/socket.io` to the backend, and in production both are served from the same origin.

## Checks

```bash
npm run check      # type-check, test, build
npm test           # 69 tests across both projects
npm run typecheck
npm run build
```

Tests run against fixtures and never reach the network. To check what OpenF1 is
actually returning before a first run:

```bash
npm run verify
```

CI runs the same checks on Node 22 and 24, audits dependencies, and builds the
container image on every push and pull request.

## Project docs

- [Backend architecture and API](./f1_backend.md)
- [Frontend architecture](./f1_frontend.md)
- [Dashboard shell and controls](./f1_shell.md)
- [Operations, commands, and known limitations](./f1_ship.md)

## Working with OpenF1 data

OpenF1 is a community mirror of a live timing feed, and its data is uneven. Two things
this project has to work around are worth knowing about if you extend it:

- **Location coordinates are in decimetres, not metres.** They are converted once, at
  ingest, in [`backend/src/domain/units.ts`](./backend/src/domain/units.ts).
- **A session's `date_start`/`date_end` describe the scheduled slot and do not reliably
  bracket the race.** Sessions have been observed whose lap data starts 93 minutes after
  `date_start` and continues for 79 minutes past `date_end`. The replay window is
  therefore derived from the lap data itself.

Some fields are simply absent for some sessions — `drs` is often null, for instance. The
backend degrades rather than failing, and says so in its log.

## License and affiliation

MIT. This project is unofficial and is not affiliated with or endorsed by Formula 1,
FOM, the FIA, or any team. Refer to the applicable OpenF1 terms when using its data.
