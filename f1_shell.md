# Dashboard shell

The shell composes the visualizer's panels. The source of truth is
[`frontend/src/App.tsx`](./frontend/src/App.tsx) and the components under
[`frontend/src/components/`](./frontend/src/components/); this describes the integrated
behaviour.

## Layout

| Width | Layout |
| --- | --- |
| Above 1180 px | Three-column grid, fixed height, nothing scrolls |
| 761–1180 px | Single scrolling column, two-up telemetry and race control |
| 760 px and below | Single scrolling column, everything full width |

In both narrow layouts the top bar and the replay scrubber stay pinned while the panels
between them scroll.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play or pause |
| `←` / `→` | Seek 10 seconds back or forward |
| `Shift` + `←` / `→` | Seek one minute back or forward |
| `↑` / `↓` | Select the previous or next driver in the timing tower |
| `M` | Enter or leave widget mode |
| `Escape` | Close the settings sheet, or leave widget mode |

Shortcuts are ignored while a text field or a contenteditable element has focus, so
typing into one does not drive the replay.

## Replay controls

The scrubber shows elapsed and total replay time, a draggable position handle, and
speed buttons from 0.5x to 8x. While the handle is held it shows the position being
dragged to rather than the one still streaming from the backend. The whole control is
disabled until the backend reports a duration.

Replay commands are sent to the backend, which owns the clock; every connected client
sees the same point in the race.

## Widget mode

Widget mode opens a compact view — circuit, leader and the top six — in a Document
Picture-in-Picture window where the browser supports it, and as a fixed in-page card
where it does not. Document Picture-in-Picture requires a user gesture and is not
available in every browser, so the fallback is not an error path.

## Settings

Map labels, trails, sector overlays, corner markers, reduced motion, measurement units,
gap mode and circuit rotation persist in browser storage per browser. "Reset to
defaults" restores all of them.

## Scope notes

The widget fallback is a fixed-position card, not a draggable window. Panels are wrapped
individually in error boundaries, so a failure in one — the track map, say — leaves the
rest of the dashboard usable and offers a retry.
