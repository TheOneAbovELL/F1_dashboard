import { createPortal } from 'react-dom';
import { useRaceStore } from '../../store/useRaceStore.js';
import { TrackMap } from '../TrackMap/TrackMap.js';
import { TimingTower } from '../Leaderboard/TimingTower.js';
import { socketService } from '../../services/socket.js';
import { clock } from '../../utils/format.js';
import { useSettings } from '../../hooks/useSettings.js';

interface Props {
  pipWindow: Window | null;
  onRestore(): void;
}

export function WidgetView({ pipWindow, onRestore }: Props) {
  const body = <WidgetBody onRestore={onRestore} floating={pipWindow === null} />;
  return pipWindow ? createPortal(body, pipWindow.document.body) : body;
}

function WidgetBody({ onRestore, floating }: { onRestore(): void; floating: boolean }) {
  const session = useRaceStore((s) => s.session);
  const leaderboard = useRaceStore((s) => s.leaderboard);
  const replay = useRaceStore((s) => s.replay);
  const driversByNumber = useRaceStore((s) => s.driversByNumber);
  const rotation = useSettings((s) => s.rotation);

  const leader = leaderboard[0];
  const leaderDriver = leader ? driversByNumber.get(leader.n) : undefined;

  return (
    <div
      className={[
        'flex flex-col overflow-hidden bg-f1-dark text-f1-text',
        floating
          ? 'fixed bottom-4 right-4 z-30 h-[480px] w-[376px] rounded-2xl border border-f1-line shadow-[0_26px_70px_rgba(0,0,0,0.78)]'
          : 'h-screen w-screen',
      ].join(' ')}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-f1-border bg-white/[0.03] px-3 py-2">
        <span className="h-5 w-1 rounded bg-f1-red shadow-[0_0_12px_rgba(225,6,0,0.8)]" />
        <div className="min-w-0">
          <div className="truncate text-[10px] font-extrabold tracking-[0.13em]">
            {session?.circuitShortName.toUpperCase() ?? 'F1'}
          </div>
          <div className="label">
            LAP {leader?.lapNumber ?? 0}/{session?.totalLaps ?? '--'} · {clock(replay.tMs)}
          </div>
        </div>

        <button
          onClick={() => (replay.playing ? socketService.pause() : socketService.play())}
          aria-label={replay.playing ? 'Pause' : 'Play'}
          className="ml-auto rounded-md border border-f1-border bg-white/5 px-2 py-1 text-[11px] hover:bg-white/10"
        >
          {replay.playing ? '❚❚' : '▶'}
        </button>
        <button
          onClick={onRestore}
          aria-label="Return to the full dashboard"
          className="rounded-md border border-f1-red/50 bg-f1-red/20 px-2 py-1 text-[11px] text-[#ff9d99] hover:bg-f1-red/35"
        >
          ⤢
        </button>
      </header>

      <div className="h-[208px] shrink-0 border-b border-f1-border">
        <TrackMap showLabels={false} showTrails showSectors={false} showCorners={false} rotation={rotation} />
      </div>

      {leaderDriver && (
        <div className="flex shrink-0 items-center gap-2 border-b border-f1-border px-3 py-1.5">
          <span className="h-3 w-1 rounded-sm" style={{ background: leaderDriver.colour }} />
          <span className="font-mono text-[11px] font-bold">{leaderDriver.acronym}</span>
          <span className="label">LEADS</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden px-1 py-1">
        <TimingTower compact maxRows={6} />
      </div>
    </div>
  );
}
