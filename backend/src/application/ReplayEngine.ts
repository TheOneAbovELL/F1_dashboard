import type { OpenF1Client } from '../infrastructure/openf1/client.js';
import type { SessionCatalog } from './SessionCatalog.js';
import type { DataSink, IDataProvider } from '../domain/IDataProvider.js';
import type {
  CarPosition, Driver, LeaderboardEntry, RaceControlMessage,
  ReplayState, Session, Telemetry, TrackGeometry, Weather,
} from '../domain/models.js';
import { buildTrackGeometry } from '../infrastructure/track/trackBuilder.js';
import { toMetres } from '../domain/units.js';
import type { RawLap } from '../infrastructure/openf1/types.js';
import { isDrsOpen } from '../infrastructure/openf1/types.js';
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

/** How far outside its samples a car is still drawn, bridging gaps in the feed. */
const SAMPLE_GRACE_MS = 30_000;

/** Replay starts shortly before the first lap and runs a little past the last. */
const LEAD_IN_MS = 5 * 60_000;
const TRAIL_OUT_MS = 3 * 60_000;

interface LapState {
  lap: number;
  last: number | null;
  best: number | null;
  s: [number | null, number | null, number | null];
}

/** Index of the last sample at or before `tMs`, so a seek does not walk the timeline. */
function seekCursor(t: Float64Array, tMs: number): number {
  let lo = 0;
  let hi = t.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t[mid]! <= tMs) lo = mid; else hi = mid - 1;
  }
  return Math.max(0, lo);
}

export class ReplayEngine implements IDataProvider {
  readonly name = 'OpenF1Replay';

  private session: Session | null = null;
  private driverList: Driver[] = [];
  private trackGeometry: TrackGeometry | null = null;

  private positions = new Map<number, Timeline>();
  private telemetry = new Map<number, TelemetryTimeline>();
  private telemetryLoading = new Set<number>();

  /** When each lap began, which is when it becomes the driver's current lap. */
  private lapRows: { n: number; lap: number; tMs: number; pitOut: boolean }[] = [];
  /** When each lap was completed, which is when its time and sectors may be shown. */
  private lapResultRows: { n: number; tMs: number; duration: number; s1: number | null; s2: number | null; s3: number | null }[] = [];
  private positionRows: { n: number; tMs: number; pos: number }[] = [];
  private intervalRows: { n: number; tMs: number; gap: number | null; interval: number | null }[] = [];
  private stintRows: { n: number; compound: string | null; lapStart: number; lapEnd: number; age: number }[] = [];
  private rcRows: RaceControlMessage[] = [];
  private weatherRows: (Weather & { tMs: number })[] = [];

  private state: ReplayState = {
    loaded: false, loadingPct: 0, playing: false,
    speed: config.REPLAY_SPEED, tMs: 0, durationMs: 0, error: null,
  };

  /**
   * Timing rows are replayed forward with a cursor per stream rather than rescanned
   * from the start on every tick; `timing` holds the state accumulated so far.
   */
  private cursors = { pos: 0, itv: 0, lap: 0, lapResult: 0, weather: 0, rc: 0 };
  private posState = new Map<number, number>();
  private itvState = new Map<number, { gap: number | null; interval: number | null }>();
  private lapStates = new Map<number, LapState>();
  private weatherState: Weather | null = null;
  private timingMs = -1;

  /** Absolute epoch ms that the replay treats as t = 0. */
  private originMs = 0;

  private sink: DataSink | null = null;
  private timer: NodeJS.Timeout | null = null;
  private wallAnchor = 0;
  private virtualAnchor = 0;
  private rcEmitted = 0;

  /**
   * `sessionKey` may be null, meaning "the most recent completed race". Resolving it is
   * deliberately deferred to `init()` so that a slow or unreachable OpenF1 cannot stop
   * the HTTP server from coming up and reporting what went wrong.
   */
  constructor(
    private readonly client: OpenF1Client,
    private requestedSessionKey: number | null,
    private readonly catalog?: SessionCatalog,
  ) {}

  private get sessionKey(): number {
    if (this.requestedSessionKey === null) {
      throw new Error('session key has not been resolved yet');
    }
    return this.requestedSessionKey;
  }

  async init(): Promise<void> {
    if (this.state.loaded) return;
    try {
      await this.load();
    } catch (err) {
      this.state.error = err instanceof Error ? err.message : String(err);
      this.sink?.state({ ...this.state });
      throw err;
    }
  }

  private async load(): Promise<void> {
    if (this.requestedSessionKey === null) {
      if (!this.catalog) throw new Error('no session key and no catalogue to pick one from');
      const recent = await this.catalog.mostRecent();
      if (!recent) throw new Error('no completed race sessions available from OpenF1');
      this.requestedSessionKey = recent.sessionKey;
      log.replay.info(
        { circuit: recent.circuitShortName, year: recent.year, sessionKey: recent.sessionKey },
        'auto-selected most recent completed race',
      );
    }

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

    const laps = await this.client.laps({ session_key: this.sessionKey });
    this.setReplayWindow(laps);
    this.setProgress(12);

    await this.loadTiming(laps);
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

  /**
   * OpenF1's `date_start`/`date_end` describe the scheduled session slot, and they do
   * not reliably bracket the running of the race — some sessions report lap data
   * starting well after `date_start` and finishing more than an hour past `date_end`.
   * Trusting that slot silently truncates the replay, so the window is taken from the
   * lap data itself and only falls back to the slot when there are no laps to go on.
   */
  private setReplayWindow(laps: RawLap[]): void {
    const session = this.session!;
    const starts: number[] = [];
    const ends: number[] = [];

    for (const l of laps) {
      if (l.date_start === null) continue;
      const start = Date.parse(l.date_start);
      if (!Number.isFinite(start)) continue;
      starts.push(start);
      if (l.lap_duration !== null) ends.push(start + l.lap_duration * 1000);
    }

    let originMs = session.startMs;
    let endMs = session.endMs;

    if (starts.length > 0) {
      originMs = Math.min(...starts) - LEAD_IN_MS;
      endMs = Math.max(...starts, ...ends) + TRAIL_OUT_MS;
    }

    if (!Number.isFinite(originMs) || !Number.isFinite(endMs) || endMs <= originMs) {
      throw new Error(`session ${this.sessionKey} has no usable time window`);
    }

    this.originMs = originMs;
    this.state.durationMs = endMs - originMs;

    log.replay.info(
      {
        sessionKey: this.sessionKey,
        fromSessionSlot: starts.length === 0,
        durationMin: Math.round(this.state.durationMs / 60_000),
        offsetFromSlotMin: Math.round((originMs - session.startMs) / 60_000),
      },
      'replay window chosen',
    );
  }

  private async loadTiming(laps: RawLap[]): Promise<void> {
    const key = { session_key: this.sessionKey };
    const base = this.originMs;

    const [positions, intervals, stints, rc, weather] = await Promise.all([
      this.client.positions(key), this.client.intervals(key),
      this.client.stints(key), this.client.raceControl(key), this.client.weather(key),
    ]);

    const started = laps.filter((l) => l.date_start !== null);

    this.lapRows = started
      .map((l) => ({
        n: l.driver_number, lap: l.lap_number,
        tMs: Date.parse(l.date_start!) - base, pitOut: l.is_pit_out_lap,
      }))
      .sort((a, b) => a.tMs - b.tMs);

    // A lap's time and sectors are only known once the car crosses the line, so they
    // are replayed at the completion instant rather than at the lap's start.
    this.lapResultRows = started
      .filter((l) => l.lap_duration !== null)
      .map((l) => ({
        n: l.driver_number,
        tMs: Date.parse(l.date_start!) - base + l.lap_duration! * 1000,
        duration: l.lap_duration!,
        s1: l.duration_sector_1, s2: l.duration_sector_2, s3: l.duration_sector_3,
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
    const startMs = this.originMs;
    const endMs = this.originMs + this.state.durationMs;
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
          bucket.t.push(Date.parse(r.date) - this.originMs);
          bucket.x.push(toMetres(r.x));
          bucket.y.push(toMetres(r.y));
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
    for (const tl of this.positions.values()) tl.cursor = seekCursor(tl.t, this.state.tMs);
    for (const tl of this.telemetry.values()) tl.cursor = seekCursor(tl.t, this.state.tMs);
    this.resetTiming();
    this.sink?.state({ ...this.state });
  }

  private resetTiming(): void {
    this.cursors = { pos: 0, itv: 0, lap: 0, lapResult: 0, weather: 0, rc: 0 };
    this.posState.clear();
    this.itvState.clear();
    this.lapStates.clear();
    this.weatherState = null;
    this.rcEmitted = 0;
    this.timingMs = -1;
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

    this.advanceTiming(this.state.tMs);

    sink.positions(this.positionsAt(this.state.tMs), this.state.tMs);
    sink.timing(this.leaderboard());

    for (const n of this.telemetry.keys()) {
      const t = this.telemetryAt(n, this.state.tMs);
      if (t) sink.telemetry(n, t);
    }

    if (this.weatherState) sink.weather(this.weatherState);

    if (this.cursors.rc !== this.rcEmitted) {
      this.rcEmitted = this.cursors.rc;
      sink.raceControl(this.rcRows.slice(Math.max(0, this.cursors.rc - 25), this.cursors.rc).reverse());
    }

    sink.state({ ...this.state });
  }

  private positionsAt(tMs: number): CarPosition[] {
    const out: CarPosition[] = [];

    for (const [n, tl] of this.positions) {
      const len = tl.t.length;
      if (len === 0) continue;

      // Outside a car's own sample window there is nothing to show: before the race it
      // would sit frozen at its garage slot, and after a retirement it would haunt the
      // spot where it stopped. The grace period bridges the gaps OpenF1 leaves mid-race.
      if (tMs < tl.t[0]! - SAMPLE_GRACE_MS || tMs > tl.t[len - 1]! + SAMPLE_GRACE_MS) continue;

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

  /**
   * Consumes every timing row up to `tMs`. Rewinding is rare (a seek backwards), so it
   * is handled by replaying from the start rather than by keeping undo information.
   */
  private advanceTiming(tMs: number): void {
    if (tMs < this.timingMs) this.resetTiming();
    this.timingMs = tMs;

    while (this.cursors.pos < this.positionRows.length && this.positionRows[this.cursors.pos]!.tMs <= tMs) {
      const r = this.positionRows[this.cursors.pos++]!;
      this.posState.set(r.n, r.pos);
    }

    while (this.cursors.itv < this.intervalRows.length && this.intervalRows[this.cursors.itv]!.tMs <= tMs) {
      const r = this.intervalRows[this.cursors.itv++]!;
      this.itvState.set(r.n, { gap: r.gap, interval: r.interval });
    }

    while (this.cursors.lap < this.lapRows.length && this.lapRows[this.cursors.lap]!.tMs <= tMs) {
      const l = this.lapRows[this.cursors.lap++]!;
      this.lapStateFor(l.n).lap = l.lap;
    }

    while (
      this.cursors.lapResult < this.lapResultRows.length &&
      this.lapResultRows[this.cursors.lapResult]!.tMs <= tMs
    ) {
      const l = this.lapResultRows[this.cursors.lapResult++]!;
      const cur = this.lapStateFor(l.n);
      cur.last = l.duration;
      cur.best = cur.best === null ? l.duration : Math.min(cur.best, l.duration);
      cur.s = [l.s1, l.s2, l.s3];
    }

    while (this.cursors.weather < this.weatherRows.length && this.weatherRows[this.cursors.weather]!.tMs <= tMs) {
      this.weatherState = this.weatherRows[this.cursors.weather++]!;
    }

    while (this.cursors.rc < this.rcRows.length && this.rcRows[this.cursors.rc]!.tMs <= tMs) {
      this.cursors.rc++;
    }
  }

  private lapStateFor(n: number): LapState {
    let cur = this.lapStates.get(n);
    if (!cur) {
      cur = { lap: 0, last: null, best: null, s: [null, null, null] };
      this.lapStates.set(n, cur);
    }
    return cur;
  }

  private leaderboard(): LeaderboardEntry[] {
    return this.driverList
      .map((d) => {
        const ls = this.lapStates.get(d.number);
        const lap = ls?.lap ?? 0;
        const stint = this.stintRows.find((s) => s.n === d.number && lap >= s.lapStart && lap <= s.lapEnd);
        const i = this.itvState.get(d.number);
        return {
          n: d.number,
          position: this.posState.get(d.number) ?? 99,
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

  async subscribeTelemetry(driverNumber: number): Promise<void> {
    if (this.telemetry.has(driverNumber) || this.telemetryLoading.has(driverNumber)) return;
    if (!this.driverList.some((d) => d.number === driverNumber)) return;
    this.telemetryLoading.add(driverNumber);

    try {
      const base = this.originMs;
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
        // Upstream leaves individual channels null on some samples; a gap reads as zero
        // rather than as NaN propagating into the typed arrays.
        tl.speed[i] = r.speed ?? 0; tl.throttle[i] = r.throttle ?? 0; tl.brake[i] = r.brake ?? 0;
        tl.gear[i] = r.n_gear ?? 0; tl.rpm[i] = r.rpm ?? 0; tl.drs[i] = isDrsOpen(r.drs) ? 1 : 0;
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
