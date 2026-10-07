import { useRaceStore } from '../../store/useRaceStore.js';
import { socketService } from '../../services/socket.js';

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

  const current = currentOverride ?? replay.tMs;
  const total = totalOverride ?? replay.durationMs;
  const playing = playingOverride ?? replay.playing;
  const onToggle = onToggleOverride ?? (() => {
    if (replay.playing) {
      socketService.pause();
    } else {
      socketService.play();
    }
  });
  const onSeek = onSeekOverride ?? ((value: number) => socketService.seek(value));

  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="rounded-xl border border-f1-border bg-f1-panel/80 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-f1-dim">
        <span>Replay</span>
        <span>{playing ? 'Live' : 'Paused'}</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className="rounded-md border border-f1-border bg-f1-red px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
        >
          {playing ? 'Pause' : 'Play'}
        </button>

        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-f1-red via-red-500 to-orange-400" style={{ width: `${pct}%` }} />
        </div>

        <input
          type="range"
          min={0}
          max={total || 0}
          value={Math.min(current, total || 0)}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="h-2 w-24 accent-f1-red"
        />
      </div>
    </div>
  );
}
