# Frontend: track visualizer

The Vite, React 18, TypeScript, and Tailwind application is implemented in
[`frontend/src/`](./frontend/src/). Dependencies and build scripts are maintained in
[`frontend/package.json`](./frontend/package.json); implementation code is intentionally
not duplicated here.

## Data and rendering

The frontend connects to the backend over Socket.IO. Low-frequency session, timing,
telemetry, weather, and race-control data is held in the Zustand race store. Car
positions bypass React state: the animation engine buffers snapshots, interpolates
between known samples with a 120 ms render delay, and the SVG car layer updates on
animation frames.

Track geometry and car positions share one coordinate mapper. The mapper uses the
backend's track bounds, so the map does not shift as cars move. Track geometry is
rendered separately from the animated cars.

## Main UI areas

- Track map, animated cars, sectors, corner markers, and optional trails.
- Timing tower with driver selection, gaps, lap/sector times, tyre compounds, and
  position-change feedback.
- Selected-driver telemetry, weather summary, and race-control feed.
- Replay controls, persisted display settings, responsive layouts, and widget mode.

User preferences are stored locally in the browser. The frontend dev server proxies
`/api` and `/socket.io` to the backend at `http://localhost:3001` by default; set
`VITE_BACKEND_URL` in the Vite environment only when using a different backend host.

Build the production frontend with `npm --prefix frontend run build`.
