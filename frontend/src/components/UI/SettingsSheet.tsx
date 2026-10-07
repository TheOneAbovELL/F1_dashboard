import { useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings.js';

const CHECKBOXES = [
  ['showLabels', 'Driver labels', 'Show car acronyms and labels on the track.'],
  ['showTrails', 'Track trails', 'Keep the motion traces behind each car.'],
  ['showSectors', 'Sector overlays', 'Display sector markers and split lines.'],
  ['showCorners', 'Corner notes', 'Annotate the circuit corners.'],
  ['reduceMotion', 'Reduced motion', 'Tone down the UI motion and transitions.'],
] as const;

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const settings = useSettings();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-f1-border bg-f1-panel p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-f1-cream">Settings</h3>
          <button
            onClick={onClose}
            className="rounded-md border border-f1-border bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-f1-dim"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 text-xs text-f1-cream">
          {CHECKBOXES.map(([key, label, hint]) => (
            <label
              key={key}
              className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-slate-950/40 px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold">{label}</span>
                <span className="block text-[10.5px] text-f1-dimmer">{hint}</span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                onChange={() => settings.toggle(key)}
                className="mt-1 h-4 w-4 accent-f1-red"
              />
            </label>
          ))}

          <div className="mt-3 border-t border-f1-border pt-3">
            <div className="label mb-2">Units</div>
            <div className="flex gap-2">
              {(['metric', 'imperial'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => settings.set('units', u)}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    settings.units === u
                      ? 'border-f1-red bg-f1-red/15 text-f1-text'
                      : 'border-f1-border bg-white/5 text-f1-dim hover:bg-white/10'
                  }`}
                >
                  {u === 'metric' ? 'km/h · °C' : 'mph · °F'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 border-t border-f1-border pt-3">
            <label className="label mb-2 block" htmlFor="rot">
              Circuit rotation · {settings.rotation}°
            </label>
            <input
              id="rot"
              type="range"
              min={0}
              max={350}
              step={10}
              value={settings.rotation}
              onChange={(e) => settings.set('rotation', Number(e.target.value))}
              className="w-full accent-f1-red"
            />
            <p className="mt-1 text-[10.5px] text-f1-dimmer">
              Some circuits read better turned. The setting is saved per browser.
            </p>
          </div>

          <button
            onClick={() => settings.reset()}
            className="mt-4 w-full rounded-lg border border-f1-border bg-white/5 py-2 text-xs font-semibold hover:bg-white/10"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
