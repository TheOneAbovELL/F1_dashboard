import { useRaceStore } from '../../store/useRaceStore.js';
import { clock } from '../../utils/format.js';

interface Props {
  onOpenSettings(): void;
  onEnterWidget(): void;
  widgetSupported: boolean;
}

const STATUS_STYLE: Record<string, string> = {
  connected: 'border-f1-green/40 bg-f1-green/10 text-f1-green',
  connecting: 'border-f1-yellow/40 bg-f1-yellow/10 text-f1-yellow',
  reconnecting: 'border-f1-yellow/40 bg-f1-yellow/10 text-f1-yellow',
  offline: 'border-f1-red/40 bg-f1-red/10 text-f1-red',
};

export function TopBar({ onOpenSettings, onEnterWidget, widgetSupported }: Props) {
  const session = useRaceStore((s) => s.session);
  const status = useRaceStore((s) => s.status);
  const replay = useRaceStore((s) => s.replay);
  const leaderboard = useRaceStore((s) => s.leaderboard);
  const driversByNumber = useRaceStore((s) => s.driversByNumber);

  const leader = leaderboard[0];
  const leaderDriver = leader ? driversByNumber.get(leader.n) : undefined;

  return (
    <header className="glass flex flex-wrap items-center gap-3 rounded-xl px-4 py-2">
      <span className="h-7 w-1 shrink-0 rounded bg-f1-red shadow-[0_0_16px_rgba(225,6,0,0.8)]" />

      <div className="min-w-0">
        <div className="text-xs font-extrabold tracking-[0.16em]">LIVE TRACK VISUALIZER</div>
        <div className="label mt-0.5 truncate">
          {session
            ? `${session.circuitShortName.toUpperCase()} ${session.year} · ${session.country.toUpperCase()}`
            : 'CONNECTING TO BACKEND'}
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Stat label="LAP" value={`${leader?.lapNumber ?? 0}/${session?.totalLaps ?? '--'}`} />
        <Stat label="TIME" value={clock(replay.tMs)} />
        <Stat label="LEADER" value={leaderDriver?.acronym ?? '---'} />

        <span
          className={`rounded-md border px-2 py-1.5 text-[9px] font-bold tracking-[0.16em] ${STATUS_STYLE[status]}`}
          role="status"
        >
          {status === 'connected' ? 'REPLAY' : status.toUpperCase()}
        </span>

        <button
          onClick={onEnterWidget}
          title={widgetSupported
            ? 'Open in a floating window (M)'
            : 'Minimise to a floating card (M) — your browser does not support a detached window'}
          aria-label="Minimise to widget"
          className="rounded-lg border border-f1-red/40 bg-f1-red/15 px-3 py-1.5 text-xs font-semibold text-[#ff9d99] hover:bg-f1-red/30"
        >
          ⤡
        </button>

        <button
          onClick={onOpenSettings}
          aria-label="Open dashboard settings"
          className="rounded-lg border border-f1-border bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
        >
          Settings
        </button>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-f1-border bg-white/5 px-2.5 py-1.5 text-center">
      <div className="label text-[7px]">{label}</div>
      <div className="font-mono text-sm font-bold text-f1-text">{value}</div>
    </div>
  );
}
