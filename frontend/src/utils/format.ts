const pad = (n: number | string, w: number) => String(n).padStart(w, '0');

export function lapTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '--:--.---';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(3)}`;
}

export function sectorTime(seconds: number | null): string {
  return seconds === null || !Number.isFinite(seconds) ? '--.---' : seconds.toFixed(3);
}

export function gap(seconds: number | null, lapsDown = 0): string {
  if (lapsDown > 0) return `+${lapsDown} LAP${lapsDown > 1 ? 'S' : ''}`;
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  return seconds >= 60
    ? `+${Math.floor(seconds / 60)}:${pad((seconds % 60).toFixed(1), 4)}`
    : `+${seconds.toFixed(3)}`;
}

export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600), 2)}:${pad(Math.floor((total % 3600) / 60), 2)}:${pad(total % 60, 2)}`;
}

export const compoundLetter = (c: string | null): string =>
  c ? ({ SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W' }[c.toUpperCase()] ?? '?') : '?';

export const compoundColour = (c: string | null): string =>
  ({ S: '#E8002D', M: '#FFD54A', H: '#E9E9F2', I: '#2BD47D', W: '#4A9FFF' }[compoundLetter(c)] ?? '#4B4B63');
