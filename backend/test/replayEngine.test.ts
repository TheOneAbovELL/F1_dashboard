import { beforeAll, describe, expect, it } from 'vitest';
import { ReplayEngine } from '../src/application/ReplayEngine.js';
import type { OpenF1Client } from '../src/infrastructure/openf1/client.js';
import type { SessionCatalog } from '../src/application/SessionCatalog.js';
import type { DataSink } from '../src/domain/IDataProvider.js';
import type {
  CarPosition, Driver, LeaderboardEntry, RaceControlMessage,
  ReplayState, Session, Telemetry, TrackGeometry, Weather,
} from '../src/domain/models.js';
import { DURATION, RACE_START, SESSION_KEY, START, fakeClient, squareLap } from './fakeClient.js';

function recorder() {
  const got = {
    session: null as Session | null,
    drivers: [] as Driver[],
    track: null as TrackGeometry | null,
    positions: [] as { p: CarPosition[]; tMs: number }[],
    timing: [] as LeaderboardEntry[][],
    telemetry: [] as { n: number; t: Telemetry }[],
    weather: [] as Weather[],
    raceControl: [] as RaceControlMessage[][],
    state: [] as ReplayState[],
  };
  const sink: DataSink = {
    session: (s) => { got.session = s; },
    drivers: (d) => { got.drivers = d; },
    track: (t) => { got.track = t; },
    positions: (p, tMs) => got.positions.push({ p, tMs }),
    timing: (l) => got.timing.push(l),
    telemetry: (n, t) => got.telemetry.push({ n, t }),
    weather: (w) => got.weather.push(w),
    raceControl: (m) => got.raceControl.push(m),
    state: (s) => got.state.push(s),
  };
  return { got, sink };
}

describe('ReplayEngine', () => {
  let engine: ReplayEngine;

  beforeAll(async () => {
    engine = new ReplayEngine(fakeClient(), SESSION_KEY);
    await engine.init();
    engine.pause();
  });

  it('loads the session, drivers and derived track', () => {
    const snap = engine.snapshot();
    expect(snap.session?.circuitShortName).toBe('Testing');
    expect(snap.session?.totalLaps).toBe(3);
    expect(snap.drivers.map((d) => d.acronym)).toEqual(['VER', 'HAM']);
    expect(snap.state.loaded).toBe(true);
    expect(snap.state.error).toBeNull();
  });

  it('reports the circuit length in metres, not raw location units', () => {
    // The fixture circuit is a 10,000-unit square, which is 1,000 m. Smoothing rounds
    // the four right angles, so the measured outline comes in a shade under that.
    const { lengthM } = engine.snapshot().track!;
    expect(lengthM).toBeGreaterThan(980);
    expect(lengthM).toBeLessThanOrEqual(1000);
  });

  it('normalises team colour to a hex triplet', () => {
    expect(engine.snapshot().drivers[0]!.colour).toBe('#3671C6');
  });

  it('starts paused at zero and spans the running of the race, not the session slot', () => {
    const { state } = engine.snapshot();
    expect(state.tMs).toBe(0);
    expect(state.durationMs).toBe(DURATION);
    expect(state.playing).toBe(false);
  });
});

describe('ReplayEngine timing', () => {
  /** Drives the engine to `tMs` after the green light and returns what it emitted. */
  async function at(sinceRaceStart: number) {
    const tMs = RACE_START + sinceRaceStart;
    const engine = new ReplayEngine(fakeClient(), SESSION_KEY);
    const { got, sink } = recorder();
    await engine.start(sink);
    engine.pause();
    got.timing.length = 0;
    got.raceControl.length = 0;
    got.weather.length = 0;
    engine.seek(tMs);
    engine.setSpeed(1);
    engine.play();
    await new Promise((r) => setTimeout(r, 160));
    engine.pause();
    await engine.stop();
    return got;
  }

  it('shows the lap in progress but no lap time until the car crosses the line', async () => {
    const got = await at(10_000);
    const board = got.timing.at(-1)!;
    expect(board.map((e) => e.n)).toEqual([1, 44]);
    expect(board[0]!.lapNumber).toBe(1);
    expect(board[0]!.lastLap).toBeNull();
    expect(board[0]!.bestLap).toBeNull();
    expect(board[0]!.sectors).toEqual([null, null, null]);
    expect(board[0]!.gapToLeader).toBeNull();
  });

  it('does not reveal a lap time before the lap it belongs to has finished', async () => {
    // VER's first lap starts at 0 and takes 60 s; at 59 s it must still be unknown.
    const before = await at(59_000);
    expect(before.timing.at(-1)!.find((e) => e.n === 1)!.lastLap).toBeNull();

    const after = await at(61_000);
    expect(after.timing.at(-1)!.find((e) => e.n === 1)!.lastLap).toBe(60);
  });

  it('accumulates laps, best lap and tyre age as the race runs', async () => {
    const got = await at(125_000);
    const ver = got.timing.at(-1)!.find((e) => e.n === 1)!;
    expect(ver.lapNumber).toBe(3);
    // Laps 1 and 2 are done (60 s and 61 s); lap 3 is still running.
    expect(ver.lastLap).toBe(61);
    expect(ver.bestLap).toBe(60);
    // Two laps of wear before the stint plus two laps completed inside it.
    expect(ver.tyreAge).toBe(4);
    expect(ver.compound).toBe('SOFT');
  });

  it('applies position changes, so the order reflects the latest classification', async () => {
    const early = await at(10_000);
    expect(early.timing.at(-1)!.map((e) => e.n)).toEqual([1, 44]);

    const late = await at(125_000);
    expect(late.timing.at(-1)!.map((e) => e.n)).toEqual([44, 1]);
  });

  it('replays race control newest first and only up to the current time', async () => {
    const early = await at(45_000);
    expect(early.raceControl.at(-1)!.map((m) => m.message)).toEqual(['GREEN LIGHT']);

    const late = await at(95_000);
    expect(late.raceControl.at(-1)!.map((m) => m.message)).toEqual([
      'YELLOW IN SECTOR 2',
      'GREEN LIGHT',
    ]);
  });

  it('seeking backwards rewinds derived state instead of keeping the later values', async () => {
    const engine = new ReplayEngine(fakeClient(), SESSION_KEY);
    const { got, sink } = recorder();
    await engine.start(sink);
    engine.pause();

    engine.seek(RACE_START + 125_000);
    engine.play();
    await new Promise((r) => setTimeout(r, 160));
    engine.pause();
    expect(got.timing.at(-1)!.find((e) => e.n === 1)!.lapNumber).toBe(3);

    engine.seek(RACE_START + 10_000);
    engine.play();
    await new Promise((r) => setTimeout(r, 160));
    engine.pause();
    const rewound = got.timing.at(-1)!.find((e) => e.n === 1)!;
    expect(rewound.lapNumber).toBe(1);
    expect(rewound.lastLap).toBeNull();
    expect(rewound.bestLap).toBeNull();
    expect(got.timing.at(-1)!.map((e) => e.n)).toEqual([1, 44]);

    await engine.stop();
  });

  it('reports the weather sample in force at the current time', async () => {
    const early = await at(10_000);
    expect(early.weather.at(-1)!.rainfall).toBe(0);

    const late = await at(125_000);
    expect(late.weather.at(-1)!.rainfall).toBe(1);
  });

  it('positions cars on the circuit in metres', async () => {
    const got = await at(30_000);
    const frame = got.positions.at(-1)!;
    expect(frame.p).toHaveLength(2);
    for (const car of frame.p) {
      // The 1 km square spans 0–250 m on each axis once converted.
      expect(car.x).toBeGreaterThanOrEqual(-1);
      expect(car.x).toBeLessThanOrEqual(251);
      expect(car.y).toBeGreaterThanOrEqual(-1);
      expect(car.y).toBeLessThanOrEqual(251);
      expect(Number.isFinite(car.h)).toBe(true);
    }
  });
});

describe('ReplayEngine failures', () => {
  it('records why loading failed so clients stop waiting', async () => {
    const broken = { sessions: async () => [] } as unknown as OpenF1Client;
    const engine = new ReplayEngine(broken, 1234);
    await expect(engine.init()).rejects.toThrow('session 1234 not found');
    expect(engine.snapshot().state.error).toContain('not found');
    expect(engine.snapshot().state.loaded).toBe(false);
  });
});

describe('ReplayEngine replay window', () => {
  /**
   * Real OpenF1 sessions have been seen reporting a two-hour slot while the lap data
   * begins 93 minutes in and runs on for another 79 minutes past the stated end. Taking
   * the slot at face value silently truncated the race to its opening minutes.
   */
  const SLOT_START = Date.parse('2026-10-04T07:00:00.000Z');
  const at = (minutes: number) => new Date(SLOT_START + minutes * 60_000).toISOString();
  const LAP_MS = 95_000;

  function lateSessionClient(): OpenF1Client {
    const base = fakeClient();
    const lapStartMins = [93, 197];
    // Location samples are offset from the fixture's own epoch, so they are rebased onto
    // this session's slot.
    const shift = SLOT_START - START;
    const locations = lapStartMins.flatMap((m) =>
      squareLap(1, m * 60_000 + shift, LAP_MS, 200),
    );

    return {
      ...base,
      sessions: async () => [{
        session_key: SESSION_KEY, meeting_key: 1, session_name: 'Race', session_type: 'Race',
        date_start: at(0), date_end: at(120), circuit_key: 1, circuit_short_name: 'Testing',
        country_name: 'Testland', location: 'Test City', year: 2026, gmt_offset: '00:00:00',
      }],
      laps: async () => lapStartMins.map((m, i) => ({
        driver_number: 1, lap_number: i === 0 ? 1 : 55, date_start: at(m),
        lap_duration: LAP_MS / 1000, duration_sector_1: 30, duration_sector_2: 30,
        duration_sector_3: 35, is_pit_out_lap: false, st_speed: 300,
      })),
      location: async (f: Record<string, unknown>) => {
        const from = f['date>='] ? Date.parse(String(f['date>='])) : -Infinity;
        const to = f['date<'] ? Date.parse(String(f['date<'])) : Infinity;
        const upto = f['date<='] ? Date.parse(String(f['date<='])) : Infinity;
        return locations.filter((r) => {
          const t = Date.parse(r.date);
          return t >= from && t < to && t <= upto;
        });
      },
      carData: async () => [],
      positions: async () => [],
      intervals: async () => [],
      stints: async () => [],
      raceControl: async () => [],
      weather: async () => [],
    } as unknown as OpenF1Client;
  }

  it('covers racing that starts late and runs past the scheduled end', async () => {
    const engine = new ReplayEngine(lateSessionClient(), SESSION_KEY);
    await engine.init();

    const { durationMs } = engine.snapshot().state;
    // 5 min lead-in, 93 min → 198.58 min of running, then a 3 min trail-out.
    expect(durationMs / 60_000).toBeCloseTo(113.6, 1);

    // The last lap begins 197 min into the slot, which is 104 min after the first lap
    // and 77 min past the scheduled end. It has to be reachable on the scrubber.
    const lastLapAt = (197 - 93) * 60_000 + 5 * 60_000;
    expect(durationMs).toBeGreaterThan(lastLapAt + LAP_MS);
  });

  it('places the first lap just after the lead-in, not at the slot start', async () => {
    const engine = new ReplayEngine(lateSessionClient(), SESSION_KEY);
    await engine.init();

    const seen: number[] = [];
    await engine.start({
      session: () => {}, drivers: () => {}, track: () => {},
      positions: (p) => seen.push(p.length),
      timing: () => {}, telemetry: () => {}, weather: () => {},
      raceControl: () => {}, state: () => {},
    });
    engine.pause();
    seen.length = 0;

    // Nothing is running during the lead-in...
    engine.seek(60_000);
    engine.play();
    await new Promise((r) => setTimeout(r, 160));
    engine.pause();
    expect(seen.at(-1)).toBe(0);

    // ...but the opening lap is there once the green light falls.
    seen.length = 0;
    engine.seek(5 * 60_000 + 30_000);
    engine.play();
    await new Promise((r) => setTimeout(r, 160));
    engine.pause();
    expect(seen.at(-1)).toBe(1);

    await engine.stop();
  });

  it('refuses a session with no laps rather than replaying an empty window', async () => {
    const noLaps = { ...fakeClient(), laps: async () => [] } as unknown as OpenF1Client;
    const engine = new ReplayEngine(noLaps, SESSION_KEY);
    await expect(engine.init()).rejects.toThrow(/no usable laps/);
    expect(engine.snapshot().state.error).toMatch(/no usable laps/);
  });
});

describe('ReplayEngine session selection', () => {
  it('picks the most recent completed race when no key is configured', async () => {
    const client = fakeClient();
    const catalog = {
      mostRecent: async () => ({
        sessionKey: SESSION_KEY, circuitShortName: 'Testing', year: 2024,
      }),
    } as unknown as SessionCatalog;

    const engine = new ReplayEngine(client, null, catalog);
    await engine.init();
    expect(engine.snapshot().session?.sessionKey).toBe(SESSION_KEY);
  });

  it('reports the failure rather than throwing before the server can start', async () => {
    const catalog = {
      mostRecent: async () => { throw new Error('OpenF1 unreachable'); },
    } as unknown as SessionCatalog;

    const engine = new ReplayEngine(fakeClient(), null, catalog);
    await expect(engine.init()).rejects.toThrow('OpenF1 unreachable');

    // The snapshot still answers, which is what /api/health reads.
    const snap = engine.snapshot();
    expect(snap.state.error).toBe('OpenF1 unreachable');
    expect(snap.state.loaded).toBe(false);
    expect(snap.session).toBeNull();
  });

  it('says so when there is no completed race to fall back on', async () => {
    const catalog = { mostRecent: async () => null } as unknown as SessionCatalog;
    const engine = new ReplayEngine(fakeClient(), null, catalog);
    await expect(engine.init()).rejects.toThrow(/no completed race sessions/);
  });
});
