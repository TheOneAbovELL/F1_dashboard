# Backend: replay service

The backend is a Node.js 20+ and TypeScript service. Its implementation lives in
[`backend/src/`](./backend/src/); this document records its design and runtime contract,
not copies of the source.

## Responsibilities

- `application/` selects a completed race and loads its timing, location, telemetry,
  weather, and race-control data through the replay provider.
- `domain/` defines the normalized models and provider interface.
- `infrastructure/openf1/` handles OpenF1 requests, authentication, rate limiting,
  retries, and response caching. `infrastructure/cache/` stores historical responses
  compressed on disk.
- `infrastructure/track/` derives circuit geometry from location samples on the
  fastest usable non-pit lap. It cleans spikes, resamples and smooths the path, then
  derives bounds, sectors, corners, and available DRS zones.
- `presentation/` exposes the HTTP API and Socket.IO events.

At startup, `REPLAY_SESSION_KEY` selects a specific session; otherwise the latest
completed race is selected. Replay data is loaded once and broadcast to connected
clients. First load can take several minutes due to the configured upstream request
rate. Cached responses make subsequent starts faster.

## Client contract

REST endpoints:

- `GET /api/health` — provider readiness and load progress.
- `GET /api/sessions` — completed race sessions.
- `GET /api/circuits` — circuits represented in the session catalogue.
- `GET /api/track` — geometry for the loaded session; returns 404 until available.

Socket.IO sends `session:update`, `drivers:update`, `track:update`,
`positions:update`, `timing:update`, `telemetry:update`, `weather:update`,
`race:control`, and `replay:state`. Clients can subscribe/unsubscribe to a driver's
telemetry and send play, pause, speed, and seek commands. Inbound driver numbers,
speeds, and seek offsets are validated before use.

## Configuration and limits

The validated environment settings and defaults are defined in
[`backend/src/config/index.ts`](./backend/src/config/index.ts); copy
[`backend/.env.example`](./backend/.env.example) to `backend/.env` to override them.
OpenF1 credentials are only used server-side. Do not put them in frontend variables or
commit a populated `.env`.

The current bootstrap always creates the replay engine. Setting `DATA_PROVIDER=live`
enables OpenF1 token authentication, but does not add a live MQTT data provider; live
race streaming remains unimplemented.
