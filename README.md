# F1 Live Track Visualizer

An unofficial Formula 1 race replay dashboard. The Node.js backend loads completed
race data from OpenF1, derives a circuit outline from car-location samples, and streams
replay state to a responsive React dashboard over Socket.IO.

## Requirements

- Node.js 20 or newer
- npm
- Git Bash or another Bash shell to use the combined launcher on Windows

## Start the complete app

From the project root, run:

```bash
bash start.sh
```

The launcher starts the backend and frontend together. Open
<http://localhost:5173>; the backend API listens on port 3001. Press `Ctrl+C` to stop
both services. If a project's dependencies are not installed, the launcher runs
`npm ci` for it first.

The backend selects the most recent completed race by default. The initial OpenF1 data
download can take several minutes; responses are cached under `backend/.cache/openf1`
for subsequent starts. To select a specific race or change backend settings, copy
[`backend/.env.example`](./backend/.env.example) to `backend/.env` and configure it.
Never commit populated environment files or credentials.

## Project docs

- [Backend architecture and API](./f1_backend.md)
- [Frontend architecture](./f1_frontend.md)
- [Dashboard shell and controls](./f1_shell.md)
- [Setup, commands, and current limitations](./f1_ship.md)

## Checks

```bash
npm --prefix backend run build
npm --prefix backend run typecheck
npm --prefix frontend run build
```

The backend also provides `npm --prefix backend test`, `verify`, and `prefetch` scripts.

## License and affiliation

This project is unofficial and is not affiliated with or endorsed by Formula 1, FOM,
the FIA, or any team. Refer to the applicable OpenF1 terms when using its data.
