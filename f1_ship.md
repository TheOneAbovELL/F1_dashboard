# Running and project status

This document covers the operational details that are not represented by source code.
The backend and frontend remain separate npm projects, but the root
[`start.sh`](./start.sh) starts both development servers together.

## One-command development startup

Requirements: Bash, Node.js 20 or newer, and npm. On Windows, use Git Bash. From the
project root, make the launcher executable once if desired, then run it:

```bash
chmod +x start.sh
./start.sh
```

Or run it without changing file permissions:

```bash
bash start.sh
```

The repository includes `backend/package-lock.json` and `frontend/package-lock.json`.
When either project's `node_modules` directory is missing, the launcher installs that
project's locked dependencies with `npm ci`, then starts both dev servers in parallel.
If you create or change a package manifest without its lockfile, generate the lockfile
first by running `npm install` in that project directory. Open
<http://localhost:5173>; the backend listens on port 3001 by default. Press `Ctrl+C` to
stop both services. On Git Bash for Windows, the launcher uses `taskkill.exe` to stop
the child process trees as well.

The backend chooses the latest completed race unless `REPLAY_SESSION_KEY` is set in
`backend/.env`. Its first uncached load may take several minutes; cached OpenF1
responses are stored under `backend/.cache/openf1`. Use
[`backend/.env.example`](./backend/.env.example) as the configuration reference. The
environment file is optional because defaults are provided. There is no frontend
`.env.example`; Vite proxies API and Socket.IO requests to the local backend by default.

To check expected OpenF1 response fields before the first dashboard start, run:

```bash
npm --prefix backend run verify
```

## Useful commands

- `npm --prefix backend run build` — compile the backend.
- `npm --prefix backend run typecheck` — type-check the backend.
- `npm --prefix backend run verify` — check expected OpenF1 response fields.
- `npm --prefix backend run prefetch` — run the track-prefetch utility.
- `npm --prefix frontend run build` — type-check and build the frontend.
- `npm --prefix backend test` — run the backend Vitest command.

## Implemented interfaces

The backend REST and Socket.IO contracts are documented in
[`f1_backend.md`](./f1_backend.md). The frontend shell behavior and shortcuts are in
[`f1_shell.md`](./f1_shell.md).

## Current limitations

- The backend bootstrap runs replay mode; a live MQTT provider is not implemented.
- The backend has a Dockerfile, but there is no frontend container, Docker Compose
  configuration, or deployment setup.
- No frontend test suite, root-level package scripts, or CI workflow is currently
  included. The backend test command exists, but no backend test files are present.
- Actual OpenF1 field availability can vary by session; use the `verify` command when
  investigating upstream response mismatches.

The project is an unofficial OpenF1-based visualizer and is not affiliated with or
endorsed by Formula 1, FOM, the FIA, or any team.
