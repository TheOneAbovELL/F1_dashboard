import type { OpenF1Client } from '../infrastructure/openf1/client.js';
import type { DataSink, IDataProvider } from '../domain/IDataProvider.js';
import type {
  CarPosition, Driver, LeaderboardEntry, RaceControlMessage,
  ReplayState, Session, Telemetry, TrackGeometry, Weather,
} from '../domain/models.js';
import { buildTrackGeometry } from '../infrastructure/track/trackBuilder.js';
import { config } from '../config/index.js';
import { log } from '../infrastructure/logger.js';

interface Timeline {
  t: Float64Array;
  x: Float32Array;
  y: Float32Array;
  cursor: number;
}

interface TelemetryTimeline {
  t: Float64Array;
  speed: Float32Array; throttle: Float32Array; brake: Float32Array;
  gear: Int8Array; rpm: Float32Array; drs: Uint8Array;
  cursor: number;
}

const DRS_OPEN = new Set([10, 12, 14]);

export class ReplayEngine implements IDataProvider {
  readonly name = 'OpenF1Replay';

  private session: Session | null = null;
  private driverList: Driver[] = [];
  private trackGeometry: TrackGeometry | null = null;

  private positions = new Map<number, Timeline>();
  private telemetry = new Map<number, TelemetryTimeline>();
  private telemetryLoading = new Set<number>();

  private lapRows: { n: number; lap: number; tMs: number; duration: number | null; s1: number | null; s2: number | null; s3: number | null; pitOut: boolean }[] = [];
  private positionRows: { n: number; tMs: number; pos: number }[] = [];
  private intervalRows: { n: number; tMs: number; gap: number | null; interval: number | null }[] = [];
  private stintRows: { n: number; compound: string | null; lapStart: number; lapEnd: number; age: number }[] = [];
  private rcRows: RaceControlMessage[] = [];
  private weatherRows: (Weather & { tMs: number })[] = [];

  private state: ReplayState = {
    loaded: false, loadingPct: 0, playing: false,
    speed: config.REPLAY_SPEED, tMs: 0, durationMs: 0,
  };

  private sink: DataSink | null = null;
  private timer: NodeJS.Timeout | null = null;
  private wallAnchor = 0;
  private virtualAnchor = 0;
  private rcEmitted = 0;

  constructor(private readonly client: OpenF1Client, private readonly sessionKey: number) {}

  async init(): Promise<void> {
    if (this.state.loaded) return;

    const [raw] = await this.client.sessions({ session_key: this.sessionKey });
    if (!raw) throw new Error(`session ${this.sessionKey} not found`);

    this.session = {
      sessionKey: raw.session_key,
      name: raw.session_name,
      type: raw.session_type,
      circuitShortName: raw.circuit_short_name,
      country: raw.country_name,
      location: raw.location,
      year: raw.year,
      startMs: Date.parse(raw.date_start),
      endMs: Date.parse(raw.date_end),
      totalLaps: null,
    };
    this.state.durationMs = this.session.endMs - this.session.startMs;

    const rawDrivers = await this.client.drivers({ session_key: this.sessionKey });
    this.driverList = rawDrivers.map((d) => ({
      number: d.driver_number,
      acronym: d.name_acronym,
      fullName: d.full_name,
      team: d.team_name,
      colour: d.team_colour ? `#${d.team_colour.replace(/^#/, '')}` : '#9AA0A6',
      countryCode: d.country_code,
      headshot: d.headshot_url,
    }));
    this.setProgress(6);

    await this.loadTiming();
    this.setProgress(22);

    this.trackGeometry = await buildTrackGeometry(
      this.client, this.sessionKey, this.session.circuitShortName,
    );
    this.setProgress(32);

    await this.loadPositions();

    this.state.loaded = true;
    this.setProgress(100);
    log.replay.info(
      { circuit: this.session.circuitShortName, drivers: this.driverList.length,
        durationMin: Math.round(this.state.durationMs / 60000) },
      'replay ready',
    );
  }

  private async loadTiming(): Promise<void> {
    const key = { session_key: this.sessionKey };
    const base = this.session!.startMs;

    const [laps, positions, intervals, stints, rc, weather] = await Promise.all([
      this.client.laps(key), this.client.positions(key), this.client.intervals(key),
      this.client.stints(key), this.client.raceControl(key), this.client.weather(key),
    ]);

    this.lapRows = laps
      .filter((l) => l.date_start !== null)
      .map((l) => ({
        n: l.driver_number, lap: l.lap_number, tMs: Date.parse(l.date_start!) - base,
        duration: l.lap_duration, s1: l.duration_sector_1, s2: l.duration_sector_2,
        s3: l.duration_sector_3, pitOut: l.is_pit_out_lap,
      }))
      .sort((a, b) => a.tMs - b.tMs);

    this.session!.totalLaps = this.lapRows.reduce((m, l) => Math.max(m, l.lap), 0) || null;

    this.positionRows = positions
      .map((p) => ({ n: p.driver_number, tMs: Date.parse(p.date) - base, pos: p.position }))
      .sort((a, b) => a.tMs - b.tMs);

    const num = (v: number | string | null): number | null =>
      typeof v === 'number' ? v : null;

    this.intervalRows = intervals
      .map((i) => ({ n: i.driver_number, tMs: Date.parse(i.date) - base,
                     gap: num(i.gap_to_leader), interval: num(i.interval) }))
      .sort((a, b) => a.tMs - b.tMs);

    this.stintRows = stints.map((s) => ({
      n: s.driver_number, compound: s.compound,
      lapStart: s.lap_start, lapEnd: s.lap_end, age: s.tyre_age_at_start ?? 0,
    }));

    this.rcRows = rc
      .map((m) => ({
        tMs: Date.parse(m.date) - base, category: m.category, flag: m.flag,
        message: m.message, lap: m.lap_number, driverNumber: m.driver_number, scope: m.scope,
      }))
      .sort((a, b) => a.tMs - b.tMs);

    this.weatherRows = weather
      .map((w) => ({
        tMs: Date.parse(w.date) - base, airTemp: w.air_temperature, trackTemp: w.track_temperature,
        humidity: w.humidity, pressure: w.pressure, windSpeed: w.wind_speed,
        windDirection: w.wind_direction, rainfall: w.rainfall,
      }))
      .sort((a, b) => a.tMs - b.tMs);
  }

  private async loadPositions(): Promise<void> {
    const { startMs, endMs } = this.session!;
    const windowMs = config.LOAD_WINDOW_SECONDS * 1000;
    const windows = Math.ceil((endMs - startMs) / windowMs);
    const acc = new Map<number, { t: number[]; x: number[]; y: number[] }>();

    for (let i = 0; i < windows; i++) {
      const from = startMs + i * windowMs;
      const to = Math.min(endMs, from + windowMs);
      try {
        const rows = await this.client.location({
          session_key: this.sessionKey,
          'date>=': new Date(from).toISOString(),
          'date<': new Date(to).toISOString(),
        });
        for (const r of rows) {
          if (!Number.isFinite(r.x) || (r.x === 0 && r.y === 0)) continue;
          let bucket = acc.get(r.driver_number);
          if (!bucket) { bucket = { t: [], x: [], y: [] }; acc.set(r.driver_number, bucket); }
          bucket.t.push(Date.parse(r.date) - startMs);
          bucket.x.push(r.x);
          bucket.y.push(r.y);
        }
      } catch (err) {
        log.replay.warn({ err, window: i }, 'location window failed, continuing');
      }
      this.setProgress(32 + Math.round((i / windows) * 66));
    }

    for (const [n, b] of acc) {
      const order = b.t.map((_, i) => i).sort((p, q) => b.t[p]! - b.t[q]!);
      const t = new Float64Array(order.length);
      const x = new Float32Array(order.length);
      const y = new Float32Array(order.length);
      order.forEach((src, dst) => { t[dst] = b.t[src]!; x[dst] = b.x[src]!; y[dst] = b.y[src]!; });
      this.positions.set(n, { t, x, y, cursor: 0 });
    }
    log.replay.info({ drivers: this.positions.size }, 'position timelines built');
  }

  private setProgress(pct: number): void {
    this.state.loadingPct = Math.min(100, Math.max(0, pct));
    this.sink?.state({ ...this.state });
  }

  async start(sink: DataSink): Promise<void> {
    this.sink = sink;
    await this.init();

    sink.session(this.session!);
    sink.drivers(this.driverList);
    if (this.trackGeometry) sink.track(this.trackGeometry);
    this.play();
  }

  play(): void {
    if (this.state.playing) return;
    this.state.playing = true;
    this.wallAnchor = Date.now();
    this.virtualAnchor = this.state.tMs;
    const interval = Math.round(1000 / config.BROADCAST_HZ);
    this.timer = setInterval(() => this.tick(), interval);
    this.sink?.state({ ...this.state });
  }

  pause(): void {
    if (!this.state.playing) return;
    this.state.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.sink?.state({ ...this.state });
  }

  setSpeed(multiplier: number): void {
    this.virtualAnchor = this.state.tMs;
    this.wallAnchor = Date.now();
    this.state.speed = Math.min(20, Math.max(0.1, multiplier));
    this.sink?.state({ ...this.state });
  }

  seek(tMs: number): void {
    this.state.tMs = Math.min(this.state.durationMs, Math.max(0, tMs));
    this.virtualAnchor = this.state.tMs;
    this.wallAnchor = Date.now();
    for (const tl of this.positions.values()) tl.cursor = 0;
    for (const tl of this.telemetry.values()) tl.cursor = 0;
    this.rcEmitted = 0;
    this.sink?.state({ ...this.state });
  }

  async stop(): Promise<void> {
    this.pause();
    this.sink = null;
  }

  private tick(): void {
    const sink = this.sink;
    if (!sink) return;

    const elapsed = (Date.now() - this.wallAnchor) * this.state.speed;
    this.state.tMs = this.virtualAnchor + elapsed;

    if (this.state.tMs >= this.state.durationMs) {
      this.state.tMs = this.state.durationMs;
      this.pause();
    }

    sink.positions(this.positionsAt(this.state.tMs), this.state.tMs);
    sink.timing(this.leaderboardAt(this.state.tMs));

    for (const n of this.telemetry.keys()) {
      const t = this.telemetryAt(n, this.state.tMs);
      if (t) sink.telemetry(n, t);
    }

    const w = this.weatherAt(this.state.tMs);
    if (w) sink.weather(w);

    const due = this.rcRows.filter((m) => m.tMs <= this.state.tMs);
    if (due.length !== this.rcEmitted) {
      this.rcEmitted = due.length;
      sink.raceControl(due.slice(-25).reverse());
    }

    sink.state({ ...this.state });
  }

  private positionsAt(tMs: number): CarPosition[] {
    const out: CarPosition[] = [];

    for (const [n, tl] of this.positions) {
      const len = tl.t.length;
      if (len === 0) continue;

      while (tl.cursor < len - 1 && tl.t[tl.cursor + 1]! < tMs) tl.cursor++;
      while (tl.cursor > 0 && tl.t[tl.cursor]! > tMs) tl.cursor--;

      const i = tl.cursor;
      const j = Math.min(len - 1, i + 1);
      const t0 = tl.t[i]!;
      const t1 = tl.t[j]!;
      const span = t1 - t0;
      const f = span > 0 ? Math.min(1, Math.max(0, (tMs - t0) / span)) : 0;

      const x = tl.x[i]! + (tl.x[j]! - tl.x[i]!) * f;
      const y = tl.y[i]! + (tl.y[j]! - tl.y[i]!) * f;

      const a = Math.max(0, i - 1);
      const b = Math.min(len - 1, j + 1);
      const h = Math.atan2(tl.y[b]! - tl.y[a]!, tl.x[b]! - tl.x[a]!);

      const q = span <= 0 ? 0 : Math.max(0, Math.min(1, 1 - (span - 400) / 3000));

      out.push({ n, x, y, h, q });
    }
    return out;
  }

  private leaderboardAt(tMs: number): LeaderboardEntry[] {
    const latest = <T extends { n: number; tMs: number }>(rows: T[]) => {
      const m = new Map<number, T>();
      for (const r of rows) { if (r.tMs > tMs) break; m.set(r.n, r); }
      return m;
    };

    const pos = latest(this.positionRows);
    const itv = latest(this.intervalRows);

    const lapState = new Map<number, { lap: number; last: number | null; best: number | null; s: [number | null, number | null, number | null] }>();
    for (const l of this.lapRows) {
      if (l.tMs > tMs) break;
      const cur = lapState.get(l.n) ?? { lap: 0, last: null, best: null, s: [null, null, null] };
      cur.lap = l.lap;
      if (l.duration !== null) {
        cur.last = l.duration;
        cur.best = cur.best === null ? l.duration : Math.min(cur.best, l.duration);
      }
      cur.s = [l.s1, l.s2, l.s3];
      lapState.set(l.n, cur);
    }

    return this.driverList
      .map((d) => {
        const ls = lapState.get(d.number);
        const lap = ls?.lap ?? 0;
        const stint = this.stintRows.find((s) => s.n === d.number && lap >= s.lapStart && lap <= s.lapEnd);
        const i = itv.get(d.number);
        return {
          n: d.number,
          position: pos.get(d.number)?.pos ?? 99,
          gapToLeader: i?.gap ?? null,
          interval: i?.interval ?? null,
          lapNumber: lap,
          lastLap: ls?.last ?? null,
          bestLap: ls?.best ?? null,
          sectors: ls?.s ?? [null, null, null],
          compound: stint?.compound ?? null,
          tyreAge: stint ? stint.age + Math.max(0, lap - stint.lapStart) : 0,
          inPit: false,
          retired: false,
        } satisfies LeaderboardEntry;
      })
      .sort((a, b) => a.position - b.position);
  }

  private telemetryAt(n: number, tMs: number): Telemetry | null {
    const tl = this.telemetry.get(n);
    if (!tl || tl.t.length === 0) return null;
    while (tl.cursor < tl.t.length - 1 && tl.t[tl.cursor + 1]! < tMs) tl.cursor++;
    while (tl.cursor > 0 && tl.t[tl.cursor]! > tMs) tl.cursor--;
    const i = tl.cursor;
    return {
      speed: tl.speed[i]!, throttle: tl.throttle[i]!, brake: tl.brake[i]!,
      gear: tl.gear[i]!, rpm: tl.rpm[i]!, drs: tl.drs[i] === 1,
    };
  }

  private weatherAt(tMs: number): Weather | null {
    let found: Weather | null = null;
    for (const w of this.weatherRows) { if (w.tMs > tMs) break; found = w; }
    return found;
  }

  async subscribeTelemetry(driverNumber: number): Promise<void> {
    if (this.telemetry.has(driverNumber) || this.telemetryLoading.has(driverNumber)) return;
    if (!this.driverList.some((d) => d.number === driverNumber)) return;
    this.telemetryLoading.add(driverNumber);

    try {
      const base = this.session!.startMs;
      const rows = (await this.client.carData({
        session_key: this.sessionKey, driver_number: driverNumber,
      })).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

      const len = rows.length;
      const tl: TelemetryTimeline = {
        t: new Float64Array(len), speed: new Float32Array(len), throttle: new Float32Array(len),
        brake: new Float32Array(len), gear: new Int8Array(len), rpm: new Float32Array(len),
        drs: new Uint8Array(len), cursor: 0,
      };
      rows.forEach((r, i) => {
        tl.t[i] = Date.parse(r.date) - base;
        tl.speed[i] = r.speed; tl.throttle[i] = r.throttle; tl.brake[i] = r.brake;
        tl.gear[i] = r.n_gear; tl.rpm[i] = r.rpm; tl.drs[i] = DRS_OPEN.has(r.drs) ? 1 : 0;
      });
      this.telemetry.set(driverNumber, tl);
      log.replay.debug({ driverNumber, samples: len }, 'telemetry loaded');
    } catch (err) {
      log.replay.warn({ err, driverNumber }, 'telemetry load failed');
    } finally {
      this.telemetryLoading.delete(driverNumber);
    }
  }

  unsubscribeTelemetry(driverNumber: number): void {
    this.telemetry.delete(driverNumber);
  }

  snapshot() {
    return {
      session: this.session, drivers: this.driverList,
      track: this.trackGeometry, state: { ...this.state },
    };
  }
}
