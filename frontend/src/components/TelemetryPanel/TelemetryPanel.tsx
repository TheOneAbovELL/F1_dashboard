import { useRaceStore } from '../../store/useRaceStore.js';
import { useSettings } from '../../hooks/useSettings.js';
import { compoundColour, compoundLetter, lapTime, sectorTime } from '../../utils/format.js';

const MAX_RPM = 15_000;

export function TelemetryPanel() {
  const selected = useRaceStore((s) => s.selectedDriver);
  const driver = useRaceStore((s) => (selected !== null ? s.driversByNumber.get(selected) : undefined));
  const telemetry = useRaceStore((s) => (selected !== null ? s.telemetry.get(selected) : undefined));
  const entry = useRaceStore((s) => s.leaderboard.find((e) => e.n === selected));
  const bestSectors = useRaceStore((s) => {
    const out: (number | null)[] = [null, null, null];
    for (const e of s.leaderboard) {
      e.sectors.forEach((v, i) => {
        if (v !== null && (out[i] === null || v < out[i]!)) out[i] = v;
      });
    }
    return out;
  });
  const units = useSettings((s) => s.units);

  if (!driver) {
    return (
      <section className="glass rounded-xl p-6 text-center">
        <p className="text-[11px] leading-relaxed text-f1-dimmer">
          Select a car on the track or in the timing tower to stream its telemetry.
        </p>
      </section>
    );
  }

  const speed = telemetry ? (units === 'imperial' ? telemetry.speed * 0.621371 : telemetry.speed) : 0;
  const rpmPct = telemetry ? Math.min(100, (telemetry.rpm / MAX_RPM) * 100) : 0;

  return (
    <section className="glass flex flex-col rounded-xl" aria-label={`Telemetry for ${driver.fullName}`}>
      <header
        className="flex items-center gap-2 border-b border-f1-border px-3 py-2"
        style={{ boxShadow: `inset 3px 0 0 ${driver.colour}` }}
      >
        <span className="text-xs font-extrabold tracking-[0.12em]">{driver.acronym}</span>
        <span className="text-[9px] tracking-[0.14em] text-f1-dimmer">#{driver.number}</span>
        <span className="ml-auto text-[9px] font-bold tracking-[0.14em]" style={{ color: driver.colour }}>
          {driver.team.toUpperCase()}
        </span>
      </header>

      <div className="p-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[44px] font-extrabold leading-none tracking-tighter tabular-nums">
            {Math.round(speed)}
          </span>
          <span className="text-[11px] text-f1-dim">{units === 'imperial' ? 'mph' : 'km/h'}</span>
          {telemetry?.drs && (
            <span className="ml-auto rounded border border-f1-green/50 bg-f1-green/15 px-2 py-0.5 text-[9px] font-bold tracking-[0.16em] text-f1-green">
              DRS
            </span>
          )}
        </div>

        <div className="my-3 grid grid-cols-2 gap-2">
          <Cell label="GEAR" value={telemetry ? (telemetry.gear > 0 ? String(telemetry.gear) : 'N') : '—'} />
          <Cell label="RPM" value={telemetry ? String(Math.round(telemetry.rpm)) : '—'} />
        </div>

        <div className="mb-3 h-[5px] overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full transition-[width] duration-75"
            style={{
              width: `${rpmPct}%`,
              background: 'linear-gradient(90deg,#2BD47D 0%,#FFD54A 60%,#E10600 88%)',
            }}
          />
        </div>

        <Bar label="THROTTLE" value={telemetry?.throttle ?? 0} from="#1F9C5A" to="#2BD47D" />
        <Bar label="BRAKE" value={telemetry?.brake ?? 0} from="#9C1F1F" to="#FF3B3B" />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Cell label="LAST LAP" value={lapTime(entry?.lastLap ?? null)} small />
          <Cell label="BEST LAP" value={lapTime(entry?.bestLap ?? null)} small />
          <Cell
            label="TYRE"
            value={`${compoundLetter(entry?.compound ?? null)} · ${entry?.tyreAge ?? 0}L`}
            small
            colour={compoundColour(entry?.compound ?? null)}
          />
          <Cell label="LAP" value={String(entry?.lapNumber ?? 0)} small />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {(entry?.sectors ?? [null, null, null]).map((s, i) => {
            const purple = s !== null && bestSectors[i] !== null && s <= bestSectors[i]! + 1e-6;
            return (
              <Cell
                key={i}
                label={`S${i + 1}`}
                value={sectorTime(s)}
                small
                colour={purple ? '#B14BFF' : undefined}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Cell({ label, value, small, colour }: {
  label: string; value: string; small?: boolean; colour?: string;
}) {
  return (
    <div className="rounded-lg border border-f1-border bg-white/[0.035] px-2 py-1.5">
      <div className="label">{label}</div>
      <div
        className={`font-mono font-semibold tabular-nums ${small ? 'text-[12px]' : 'text-base'}`}
        style={colour ? { color: colour } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function Bar({ label, value, from, to }: { label: string; value: number; from: string; to: string }) {
  return (
    <div className="mb-2">
      <div className="label">{label}</div>
      <div
        className="mt-1 h-[7px] overflow-hidden rounded-full bg-white/[0.07]"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-75"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: `linear-gradient(90deg,${from},${to})` }}
        />
      </div>
    </div>
  );
}
