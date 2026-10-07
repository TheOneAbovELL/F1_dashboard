# Backend: replay service

A Node.js 22+ TypeScript service. The implementation is in
[`backend/src/`](./backend/src/); this document records the design and the runtime
contract rather than repeating the source.

## Responsibilities

- `application/` chooses a completed race and loads its timing, location, telemetry,
  weather and race-control data, then replays it on a clock.
- `domain/` holds the normalised models, the provider interface, and the unit
  conversion applied to incoming coordinates.
- `infrastructure/openf1/` handles requests, authentication, rate limiting, retries with
  backoff, and response caching. `infrastructure/cache/` stores responses gzipped on
  disk, keyed by URL.
- `infrastructure/track/` derives circuit geometry from the location samples of the
  fastest usable non-pit lap: it removes spikes, resamples by arc length, smooths the
  closed path, then derives bounds, sector splits, corners and DRS zones.
- `presentation/` exposes the HTTP API, the Socket.IO stream, and the built dashboard.

## Two things OpenF1 gets wrong

Both are handled in the backend, and both are easy to reintroduce if this is forgotten.

**Location coordinates are decimetres.** A raw path length of 54,729 is 5,472.9 m, not
54.7 km. Samples are converted at ingest through
[`domain/units.ts`](./backend/src/domain/units.ts), so every length downstream — circuit
length, corner radii, DRS zone lengths, car size on screen — is in metres.

**A session's `date_start` and `date_end` describe the scheduled slot, and the race
does not reliably fall inside it.** One observed session reported a two-hour slot while
its lap data began 93 minutes in and continued 79 minutes past the stated end. Taking
the slot at face value truncates the replay to the opening minutes and leaves the
leaderboard empty. `ReplayEngine.setReplayWindow` therefore derives the window from the
lap data — from shortly before the first lap to shortly after the last — and only falls
back to the scheduled slot when there are no laps at all.

## Replay semantics

Replay time is milliseconds from the start of the derived window. Each stream of timing
rows is consumed forward through its own cursor, so a tick costs what has changed rather
than a rescan of the session; seeking backwards replays from the start of the window,
which is rare enough not to matter.

A lap's number becomes current when the lap *starts*; its time and sector times only
appear once the lap has been *completed*. Publishing them at the lap's start would show
a driver's lap time before they had driven it.

A car is only drawn while the replay clock is inside that car's own samples, give or
take a grace period that bridges gaps in the feed. Without that, cars sit frozen on
their garage slots before the start and haunt the spot where they retired.

## Client contract

REST:

- `GET /api/health` — `ok`, `loading` with a percentage, or `error` with a message and
  a 503.
- `GET /api/sessions` — completed race sessions, newest first.
- `GET /api/circuits` — circuits represented in the catalogue.
- `GET /api/track` — geometry for the loaded session; 404 until it is built.

Anything else under `/api` returns a JSON 404.

Socket.IO emits `session:update`, `drivers:update`, `track:update`, `positions:update`,
`timing:update`, `telemetry:update`, `weather:update`, `race:control` and
`replay:state`. Positions and telemetry go out as volatile frames, since a dropped one
is replaced a tenth of a second later. Clients subscribe and unsubscribe to a driver's
telemetry and send play, pause, speed and seek commands; inbound driver numbers, speeds
and seek offsets are all validated before use.

## Startup and failure

The server resolves its session lazily, inside the replay engine, so nothing is awaited
before the port is open. If OpenF1 is unreachable, or the chosen session cannot be
built, the process stays up and reports the reason through `/api/health` and through
`replay:state`, which the dashboard shows to the user. The alternative — exiting before
listening — leaves nothing to ask what went wrong.

Shutdown on `SIGTERM`/`SIGINT` stops the provider, closes the Socket.IO server and the
HTTP server, and force-exits after ten seconds if a connection will not drain.

## Configuration and limits

Settings and defaults are defined and validated in
[`backend/src/config/index.ts`](./backend/src/config/index.ts); copy
[`backend/.env.example`](./backend/.env.example) to `backend/.env` to override them. An
invalid value stops the process at startup with the offending field named.

Upstream requests are serialised through a single queue at `OPENF1_REQUESTS_PER_SECOND`,
with retries on 429, 5xx, timeouts and network errors, and exponential backoff with
jitter. Successful responses are cached on disk indefinitely; historical race data does
not change.

Setting `DATA_PROVIDER=live` enables OpenF1 token authentication but does not add a live
MQTT provider. Live streaming remains unimplemented.
