import type { OpenF1Client } from '../openf1/client.js';
import type { TrackGeometry } from '../../domain/models.js';
import { log } from '../logger.js';

const SAMPLE_COUNT = 1400;
const SMOOTH_PASSES = 2;
const SMOOTH_WINDOW = 5;

export async function buildTrackGeometry(
  client: OpenF1Client,
  sessionKey: number,
  circuitShortName: string,
): Promise<TrackGeometry> {
  const laps = await client.laps({ session_key: sessionKey });
  const candidates = laps.filter(
    (l) => l.lap_duration !== null && l.date_start !== null && !l.is_pit_out_lap,
  );
  if (candidates.length === 0) {
    throw new TrackBuildError(`no usable laps for session ${sessionKey}`);
  }
  candidates.sort((a, b) => (a.lap_duration ?? 1e9) - (b.lap_duration ?? 1e9));
  const lap = candidates[0]!;

  const startMs = Date.parse(lap.date_start!);
  const endMs = startMs + lap.lap_duration! * 1000;

  const raw = await client.location({
    session_key: sessionKey,
    driver_number: lap.driver_number,
    'date>=': new Date(startMs).toISOString(),
    'date<=': new Date(endMs).toISOString(),
  });

  const samples = raw
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && !(p.x === 0 && p.y === 0))
    .map((p) => ({ t: Date.parse(p.date), x: p.x, y: p.y }))
    .sort((a, b) => a.t - b.t);

  if (samples.length < 80) {
    throw new TrackBuildError(
      `only ${samples.length} location samples for ${circuitShortName}; cannot build outline`,
    );
  }

  const steps = samples.slice(1).map((p, i) => Math.hypot(p.x - samples[i]!.x, p.y - samples[i]!.y));
  const medianStep = median(steps) || 1;
  const cleaned: typeof samples = [samples[0]!];
  for (let i = 1; i < samples.length; i++) {
    const prev = cleaned[cleaned.length - 1]!;
    const d = Math.hypot(samples[i]!.x - prev.x, samples[i]!.y - prev.y);
    if (d <= medianStep * 6) cleaned.push(samples[i]!);
  }

  const resampled = resampleByArcLength(cleaned.map((p) => [p.x, p.y] as [number, number]), SAMPLE_COUNT);
  let points = resampled;
  for (let i = 0; i < SMOOTH_PASSES; i++) points = smoothClosed(points, SMOOTH_WINDOW);

  const cumulative = cumulativeLengths(points);
  const lengthM = cumulative[cumulative.length - 1]!;
  const sectorSplits = mapSectorsToDistance(cleaned, lap, startMs, lengthM);

  let drsZones: [number, number][] = [];
  try {
    drsZones = await detectDrsZones(client, sessionKey, lap.driver_number, startMs, endMs, cleaned, lengthM);
  } catch (err) {
    log.track.warn({ err, circuitShortName }, 'DRS detection failed; continuing without zones');
  }

  const corners = detectCorners(points, cumulative);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);

  log.track.info(
    { circuitShortName, lengthM: Math.round(lengthM), corners: corners.length, drs: drsZones.length },
    'built track geometry',
  );

  return {
    circuitShortName,
    sessionKey,
    points,
    cumulative,
    lengthM,
    bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
    sectorSplits,
    drsZones,
    corners,
    builtAt: new Date().toISOString(),
  };
}

export class TrackBuildError extends Error {}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

function cumulativeLengths(pts: [number, number][]): number[] {
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i % pts.length]!;
    cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return cum;
}

function resampleByArcLength(pts: [number, number][], count: number): [number, number][] {
  const closed = [...pts, pts[0]!];
  const cum = cumulativeLengths(pts);
  const total = cum[cum.length - 1]!;
  const step = total / count;
  const out: [number, number][] = [];
  let seg = 0;

  for (let i = 0; i < count; i++) {
    const target = i * step;
    while (seg < cum.length - 2 && cum[seg + 1]! < target) seg++;
    const segLen = cum[seg + 1]! - cum[seg]!;
    const f = segLen > 0 ? (target - cum[seg]!) / segLen : 0;
    const a = closed[seg]!;
    const b = closed[seg + 1]!;
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

function smoothClosed(pts: [number, number][], window: number): [number, number][] {
  const n = pts.length;
  const half = (window - 1) / 2;
  return pts.map((_, i) => {
    let sx = 0, sy = 0;
    for (let k = -half; k <= half; k++) {
      const p = pts[(i + k + n) % n]!;
      sx += p[0]; sy += p[1];
    }
    return [sx / window, sy / window] as [number, number];
  });
}

function mapSectorsToDistance(
  samples: { t: number; x: number; y: number }[],
  lap: { duration_sector_1: number | null; duration_sector_2: number | null },
  startMs: number,
  lengthM: number,
): [number, number, number] {
  const s1 = lap.duration_sector_1;
  const s2 = lap.duration_sector_2;
  if (s1 === null || s2 === null) {
    return [lengthM / 3, (lengthM * 2) / 3, lengthM];
  }
  const distanceAt = (atMs: number): number => {
    let run = 0;
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1]!;
      const cur = samples[i]!;
      run += Math.hypot(cur.x - prev.x, cur.y - prev.y);
      if (cur.t >= atMs) return run;
    }
    return run;
  };
  const raw = cumulativeLengths(samples.map((p) => [p.x, p.y] as [number, number]));
  const scale = lengthM / (raw[raw.length - 1]! || lengthM);
  return [
    distanceAt(startMs + s1 * 1000) * scale,
    distanceAt(startMs + (s1 + s2) * 1000) * scale,
    lengthM,
  ];
}

async function detectDrsZones(
  client: OpenF1Client,
  sessionKey: number,
  driverNumber: number,
  startMs: number,
  endMs: number,
  samples: { t: number; x: number; y: number }[],
  lengthM: number,
): Promise<[number, number][]> {
  const rows = await client.carData({
    session_key: sessionKey,
    driver_number: driverNumber,
    'date>=': new Date(startMs).toISOString(),
    'date<=': new Date(endMs).toISOString(),
  });

  const raw = cumulativeLengths(samples.map((p) => [p.x, p.y] as [number, number]));
  const scale = lengthM / (raw[raw.length - 1]! || lengthM);
  const distAt = (ms: number): number => {
    let lo = 0, hi = samples.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (samples[mid]!.t < ms) lo = mid + 1; else hi = mid;
    }
    return (raw[lo] ?? 0) * scale;
  };

  const open = [10, 12, 14];
  const zones: [number, number][] = [];
  let zoneStart: number | null = null;

  for (const r of rows.sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
    const isOpen = open.includes(r.drs);
    const d = distAt(Date.parse(r.date));
    if (isOpen && zoneStart === null) zoneStart = d;
    if (!isOpen && zoneStart !== null) {
      if (d - zoneStart > 120) zones.push([zoneStart, d]);
      zoneStart = null;
    }
  }
  if (zoneStart !== null) zones.push([zoneStart, lengthM]);
  return zones;
}

function detectCorners(pts: [number, number][], cum: number[]): number[] {
  const n = pts.length;
  const radii = new Float64Array(n);
  const look = Math.max(3, Math.round(n / 220));

  for (let i = 0; i < n; i++) {
    const a = pts[(i - look + n) % n]!;
    const b = pts[i]!;
    const c = pts[(i + look) % n]!;
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
    radii[i] = area < 1e-6 ? 1e6 : (ab * bc * ca) / (4 * area);
  }

  const THRESHOLD = 260;
  const corners: number[] = [];
  let runStart = -1;

  for (let i = 0; i <= n; i++) {
    const tight = i < n && radii[i]! < THRESHOLD;
    if (tight && runStart === -1) runStart = i;
    if (!tight && runStart !== -1) {
      let apex = runStart;
      for (let k = runStart; k < i; k++) if (radii[k]! < radii[apex]!) apex = k;
      if (cum[i]! - cum[runStart]! > 25) corners.push(apex);
      runStart = -1;
    }
  }
  return corners;
}
