# Dashboard shell

The shell composes the existing visualizer features; source of truth is
[`frontend/src/App.tsx`](./frontend/src/App.tsx) and the components under
[`frontend/src/components/`](./frontend/src/components/). This file describes the
integrated behavior rather than repeating component source.

## Layout and controls

The responsive dashboard includes the top bar, timing tower, track map, telemetry,
weather, race-control feed, replay scrubber, settings sheet, and compact widget view.
At widths up to 1180 px it switches to a compact layout; at 760 px and below it uses a
mobile layout.

The widget opens in a Document Picture-in-Picture window where supported. Otherwise,
the same view appears as a floating in-page card. Settings such as map labels, trails,
sectors, rotation, measurement units, and gap mode persist in browser storage.

Keyboard shortcuts currently implemented:

- `Space`: play/pause replay.
- `ArrowUp` / `ArrowDown`: select the previous/next timing-tower driver.
- `M`: toggle widget mode.
- `Escape`: close settings or leave widget mode.

The replay scrubber also supports pointer/touch seeking via its range control.

## Scope notes

The left/right keyboard seek described in earlier drafts is not currently wired.
The widget fallback is a fixed-position card, not a draggable window. Document
Picture-in-Picture availability depends on browser support and user-gesture rules.
