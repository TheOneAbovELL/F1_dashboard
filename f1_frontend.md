# Frontend: track visualizer

A Vite, React 18, TypeScript and Tailwind 4 application under
[`frontend/src/`](./frontend/src/). Dependencies and scripts live in
[`frontend/package.json`](./frontend/package.json).

## Data and rendering

The dashboard connects to the backend over Socket.IO. Session, timing, telemetry,
weather and race-control data is held in a Zustand store and rendered through React.

Car positions deliberately bypass React. The animation engine buffers incoming
snapshots and interpolates between them on a 120 ms delay, and the SVG car layer writes
transforms directly to DOM nodes on each animation frame. At twenty-odd cars and ten
updates a second, routing positions through React state would re-render the tree
continuously for no benefit.

When the replay jumps — a seek in either direction, rather than ordinary playback — the
engine's buffer is discarded and its generation counter advances. The car layer watches
that counter and drops the motion trails, which would otherwise draw a straight line
from where each car was to where it now is.

Track geometry and car positions share one coordinate mapper, which works from the
backend's bounds so the map does not drift as cars move. The mapper clamps its padding
against the panel it is given: a panel shorter than twice the padding would otherwise
produce a negative scale and collapse or invert the circuit.

Cars are drawn larger than life, as broadcast graphics are. At true scale a Formula 1
car is about three pixels long on a full-screen circuit map; the layer exaggerates the
size, clamps it to a readable range, and falls back to a simplified car symbol when the
map is small enough that the detailed one would be mush.

## Layout

The desktop layout — above 1180 px — is a fixed-height three-column grid: timing tower,
track map with the weather strip, telemetry and race control, and the replay scrubber
across the bottom. Nothing scrolls.

Below 1180 px there is not room for all of that at once, so the panels stack in a single
scrolling column with the top bar and the scrubber pinned. This is why the narrow
layout is a separate branch rather than the same grid with different track sizes:
squeezing five panels into one screen is what previously collapsed the map and the
timing tower to nothing.

## Main UI areas

- Track map with animated cars, sector colouring, corner markers and optional trails.
- Timing tower with driver selection, gaps, lap and sector times, tyre compounds, and
  position-change highlighting.
- Telemetry for the selected driver, a weather strip, and the race-control feed.
- A replay scrubber with play/pause, elapsed and total time, seeking, and speed
  selection; dragging the handle shows where you are dragging rather than fighting the
  position still arriving from the backend.
- A settings sheet whose preferences persist per browser, and a widget mode that uses
  Document Picture-in-Picture where the browser supports it.

## Theme

Tailwind 4 takes its theme from CSS. The palette, fonts and custom animation are defined
in an `@theme` block in [`src/index.css`](./frontend/src/index.css); there is no
`tailwind.config.js`. Each token becomes a utility automatically, so `--color-f1-red`
gives `bg-f1-red`, `text-f1-red` and so on.

## Development and build

The dev server proxies `/api` and `/socket.io` to `http://localhost:3001`. Set
`VITE_BACKEND_URL` only when pointing at a different backend host. In production the
backend serves the built bundle from its own origin, so no proxy and no cross-origin
allowance are involved.

`npm --prefix frontend run build` type-checks and builds. `npm --prefix frontend test`
runs the suites covering the coordinate mapper, the animation engine, the formatters and
the livery helpers — all pure logic, no DOM and no network.
