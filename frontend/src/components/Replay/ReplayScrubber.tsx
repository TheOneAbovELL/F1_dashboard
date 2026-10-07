import { useEffect, useRef, useState } from 'react';
import { useRaceStore } from '../../store/useRaceStore.js';
import { socketService } from '../../services/socket.js';
import { clock } from '../../utils/format.js';

const SPEEDS = [0.5, 1, 2, 4, 8] as const;

export interface ReplayScrubberProps {
  current?: number;
  total?: number;
  playing?: boolean;
  onToggle?: () => void;
  onSeek?: (value: number) => void;
}

export function ReplayScrubber({
  current: currentOverride,
  total: totalOverride,
  playing: playingOverride,
  onToggle: onToggleOverride,
  onSeek: onSeekOverride,
}: ReplayScrubberProps = {}) {
  const replay = useRaceStore((state) => state.replay);

  const total = totalOverride ?? replay.durationMs;
  const playing = playingOverride ?? replay.playing;
  const onToggle =
    onToggleOverride ??
    (() => {
      if (replay.playing) socketService.pause();
      else socketService.play();
    });
  const onSeek = onSeekOverride ?? ((value: number) => socketService.seek(value));

  // While the handle is held, the slider shows where the user is dragging rather than
  // the replay position still streaming in from the backend.
  const [dragging, setDragging] = useState<number | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const release = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(null);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, []);

  const streamed = currentOverride ?? replay.tMs;
  const current = dragging ?? streamed;
  const pct = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;

  return (
    <div className="glass rounded-xl px-3 py-2.5" aria-label="Replay controls">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          aria-label={playing ? 'Pause replay' : 'Play replay'}
          className="w-[72px] shrink-0 rounded-md bg-f1-red px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white hover:brightness-110"
        >
          {playing ? 'Pause' : 'Play'}
        </button>

        <span className="shrink-0 font-mono text-[11px] tabular-nums text-f1-dim">
          {clock(current)}
        </span>

        <div className="relative flex min-w-0 flex-1 items-center">
          <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-f1-red to-orange-400"
              style={{ width: `${pct}%` }}
            />
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, total)}
            step={1000}
            value={Math.min(current, Math.max(0, total))}
            disabled={total <= 0}
            aria-label="Seek through the race"
            aria-valuetext={clock(current)}
            onPointerDown={() => {
              draggingRef.current = true;
            }}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (draggingRef.current) setDragging(next);
              onSeek(next);
            }}
            className="relative w-full cursor-pointer appearance-none bg-transparent accent-f1-red disabled:cursor-not-allowed"
          />
        </div>

        <span className="shrink-0 font-mono text-[11px] tabular-nums text-f1-dimmer">
          {clock(total)}
        </span>

        <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Replay speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => socketService.setSpeed(s)}
              aria-pressed={replay.speed === s}
              className={`rounded border px-1.5 py-1 font-mono text-[10px] leading-none ${
                replay.speed === s
                  ? 'border-f1-red bg-f1-red/20 text-f1-text'
                  : 'border-f1-border bg-white/5 text-f1-dim hover:text-f1-text'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
