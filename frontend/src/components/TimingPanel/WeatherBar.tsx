import { useRaceStore } from '../../store/useRaceStore.js';
import { useSettings } from '../../hooks/useSettings.js';

export function WeatherBar() {
  const weather = useRaceStore((s) => s.weather);
  const units = useSettings((s) => s.units);

  const temp = (c: number) => (units === 'imperial' ? `${(c * 1.8 + 32).toFixed(1)}°F` : `${c.toFixed(1)}°C`);

  return (
    <section className="glass flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2" aria-label="Weather">
      <Item label="TRACK" value={weather ? temp(weather.trackTemp) : '—'} />
      <Item label="AIR" value={weather ? temp(weather.airTemp) : '—'} />
      <Item label="HUMIDITY" value={weather ? `${weather.humidity.toFixed(0)}%` : '—'} />
      <Item label="WIND" value={weather ? `${weather.windSpeed.toFixed(1)} m/s` : '—'} />
      <Item
        label="RAIN"
        value={weather ? (weather.rainfall > 0 ? 'YES' : 'DRY') : '—'}
        colour={weather && weather.rainfall > 0 ? '#4A9FFF' : undefined}
      />
      {weather && (
        <div
          className="ml-auto flex items-center gap-1.5 text-f1-dimmer"
          title={`Wind from ${Math.round(weather.windDirection)}°`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <g transform={`rotate(${weather.windDirection} 8 8)`}>
              <path d="M8 2 L11 13 L8 10.5 L5 13 Z" fill="currentColor" />
            </g>
          </svg>
          <span className="label">{Math.round(weather.windDirection)}°</span>
        </div>
      )}
    </section>
  );
}

function Item({ label, value, colour }: { label: string; value: string; colour?: string }) {
  return (
    <div className="border-r border-f1-border pr-3 last:border-0">
      <div className="label">{label}</div>
      <div className="font-mono text-[12px] font-semibold tabular-nums" style={colour ? { color: colour } : undefined}>
        {value}
      </div>
    </div>
  );
}
