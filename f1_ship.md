# Running and project status

This document covers the operational details that are not represented by source code.
The backend and frontend remain separate npm projects, but the root
[`start.sh`](./start.sh) starts both development servers together.

## One-command development startup

Requirements: Bash, Node.js 20 or newer, and npm. From Git Bash, WSL, or another Bash
shell at the project root, run:

```bash
bash start.sh
```

The launcher installs a project's locked dependencies with `npm ci` if that project's
`node_modules` directory is missing, then starts the backend and frontend in parallel.
Open <http://localhost:5173>; the backend listens on port 3001 by default. Press
`Ctrl+C` once to stop both services.

The backend chooses the latest completed race unless `REPLAY_SESSION_KEY` is set in
`backend/.env`. Its first uncached load may take several minutes; cached OpenF1
responses are stored under `backend/.cache/openf1`. Use
[`backend/.env.example`](./backend/.env.example) as the configuration reference.

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
