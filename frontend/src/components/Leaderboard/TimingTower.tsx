import { useEffect, useMemo, useRef } from 'react';
import { useRaceStore } from '../../store/useRaceStore.js';
import { useSettings } from '../../hooks/useSettings.js';
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery.js';
import { TimingRow, type SessionBests } from './TimingRow.js';

interface Props { compact?: boolean; maxRows?: number }

const ROW = 26;
const ROW_COMPACT = 23;

export function TimingTower({ compact = false, maxRows }: Props) {
  const leaderboard = useRaceStore((s) => s.leaderboard);
  const driversByNumber = useRaceStore((s) => s.driversByNumber);
  const selected = useRaceStore((s) => s.selectedDriver);
  const selectDriver = useRaceStore((s) => s.selectDriver);
  const gapMode = useSettings((s) => s.gapMode);
  const setSetting = useSettings((s) => s.set);
  const reduceMotion = usePrefersReducedMotion();

  const rowHeight = compact ? ROW_COMPACT : ROW;
  const rows = maxRows ? leaderboard.slice(0, maxRows) : leaderboard;

  const lastPos = useRef(new Map<number, number>());
  const movedAt = useRef(new Map<number, { at: number; gained: boolean }>());

  useEffect(() => {
    const now = performance.now();
    for (const e of leaderboard) {
      const prev = lastPos.current.get(e.n);
      if (prev !== undefined && prev !== e.position) {
        movedAt.current.set(e.n, { at: now, gained: e.position < prev });
      }
      lastPos.current.set(e.n, e.position);
    }
  }, [leaderboard]);

  const bests = useMemo<SessionBests>(() => {
    const out: SessionBests = { lap: null, sectors: [null, null, null] };
    for (const e of leaderboard) {
      if (e.bestLap !== null && (out.lap === null || e.bestLap < out.lap)) out.lap = e.bestLap;
      e.sectors.forEach((s, i) => {
        if (s !== null && (out.sectors[i] === null || s < out.sectors[i]!)) out.sectors[i] = s;
      });
    }
    return out;
  }, [leaderboard]);

  const personal = useRef(new Map<number, [number | null, number | null, number | null]>());
  for (const e of leaderboard) {
    const cur = personal.current.get(e.n) ?? [null, null, null];
    e.sectors.forEach((s, i) => {
      if (s !== null && (cur[i] === null || s < cur[i]!)) cur[i] = s;
    });
    personal.current.set(e.n, cur);
  }

  const now = performance.now();

  return (
    <section className="glass flex min-h-0 flex-col overflow-hidden rounded-xl" aria-label="Timing tower">
      {!compact && (
        <header className="flex items-center justify-between border-b border-f1-border px-3 py-2">
          <span className="label">Position · Driver</span>
          <button
            onClick={() => setSetting('gapMode', gapMode === 'leader' ? 'interval' : 'leader')}
            className="label rounded border border-f1-border px-1.5 py-0.5 text-f1-dim hover:text-f1-text"
            title="Switch between gap to leader and gap to the car ahead"
          >
            {gapMode === 'leader' ? 'TO LEADER' : 'INTERVAL'}
          </button>
        </header>
      )}

      <div className="relative mx-0 my-1.5 flex-1 overflow-hidden" style={{ minHeight: rows.length * rowHeight }}>
        {rows.map((entry, i) => {
          const driver = driversByNumber.get(entry.n);
          if (!driver) return null;
          const moved = movedAt.current.get(entry.n);
          return (
            <TimingRow
              key={entry.n}
              entry={entry}
              driver={driver}
              index={i}
              rowHeight={rowHeight}
              selected={selected === entry.n}
              gapMode={gapMode}
              bests={bests}
              personalBestSectors={personal.current.get(entry.n) ?? [null, null, null]}
              movedAgo={moved ? now - moved.at : Infinity}
              gained={moved?.gained ?? false}
              animate={!reduceMotion}
              onSelect={selectDriver}
            />
          );
        })}

        {rows.length === 0 && (
          <p className="p-5 text-center text-[11px] text-f1-dimmer">Waiting for timing data…</p>
        )}
      </div>
    </section>
  );
}
