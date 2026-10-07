import { memo } from 'react';
import type { Driver, LeaderboardEntry } from '../../types/index.js';
import { compoundColour, compoundLetter, gap, lapTime, sectorTime } from '../../utils/format.js';

export interface SessionBests {
  lap: number | null;
  sectors: [number | null, number | null, number | null];
}

interface Props {
  entry: LeaderboardEntry;
  driver: Driver;
  index: number;
  rowHeight: number;
  selected: boolean;
  gapMode: 'leader' | 'interval';
  bests: SessionBests;
  personalBestSectors: [number | null, number | null, number | null];
  movedAgo: number;
  gained: boolean;
  animate: boolean;
  onSelect(n: number): void;
}

function sectorClass(
  value: number | null,
  sessionBest: number | null,
  personalBest: number | null,
): string {
  if (value === null) return 'bg-white/10';
  if (sessionBest !== null && value <= sessionBest + 1e-6) return 'bg-f1-purple';
  if (personalBest !== null && value <= personalBest + 1e-6) return 'bg-f1-green';
  return 'bg-f1-yellow/70';
}

function safeComparator(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export const TimingRow = memo(function TimingRow({
  entry, driver, index, rowHeight, selected, gapMode, bests,
  personalBestSectors, movedAgo, gained, animate, onSelect,
}: Props) {
  const recentlyMoved = movedAgo < 2600;
  const value =
    entry.position === 1
      ? lapTime(entry.bestLap)
      : gap(gapMode === 'leader' ? entry.gapToLeader : entry.interval);

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.n)}
      aria-current={selected ? 'true' : undefined}
      aria-label={`Position ${entry.position}, ${driver.fullName}, ${driver.team}`}
      className={[
        'absolute inset-x-1.5 grid grid-cols-[20px_5px_1fr_auto_34px_18px] items-center gap-2',
        'rounded-md px-2 text-left font-mono text-[11px] will-change-transform',
        animate ? 'transition-[transform,background-color] duration-[450ms] ease-out' : '',
        selected ? 'bg-f1-red/15 shadow-[inset_2px_0_0_#E10600]' : 'hover:bg-white/[0.055]',
        recentlyMoved && !selected ? (gained ? 'bg-f1-green/10' : 'bg-f1-red/[0.08]') : '',
      ].join(' ')}
      style={{ height: rowHeight - 2, transform: `translateY(${index * rowHeight}px)` }}
    >
      <span className="text-center text-[10px] text-f1-dim">{entry.position}</span>

      <span
        className="h-3.5 rounded-sm"
        style={{
          background: driver.colour,
          boxShadow: entry.retired ? 'none' : undefined,
          opacity: entry.retired ? 0.3 : 1,
        }}
      />

      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="font-bold tracking-wide">{driver.acronym}</span>
        <span className="truncate text-[8.5px] tracking-tight text-f1-dimmer">
          {driver.team.toUpperCase()}
        </span>
      </span>

      <span
        className={[
          'text-right text-[10.5px] tabular-nums',
          entry.inPit ? 'text-f1-yellow' : entry.retired ? 'text-f1-dimmer line-through' : 'text-f1-text/85',
        ].join(' ')}
      >
        {entry.retired ? 'OUT' : entry.inPit ? 'PIT' : value}
      </span>

      <span className="flex gap-[2px]" aria-hidden>
        {entry.sectors.map((s, i) => (
          <span
            key={i}
            title={sectorTime(s)}
            className={`h-[5px] w-[10px] rounded-[1px] ${sectorClass(
              s,
              safeComparator(bests.sectors[i]),
              safeComparator(personalBestSectors[i]),
            )}`}
          />
        ))}
      </span>

      <span
        className="grid h-[18px] w-[18px] place-items-center justify-self-end rounded-full border-2 text-[8px] font-extrabold"
        style={{ borderColor: compoundColour(entry.compound), color: compoundColour(entry.compound) }}
        title={`${entry.compound ?? 'unknown'} · ${entry.tyreAge} laps`}
      >
        {compoundLetter(entry.compound)}
      </span>
    </button>
  );
});
