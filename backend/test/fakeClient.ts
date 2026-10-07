import type { OpenF1Client } from '../src/infrastructure/openf1/client.js';

export const SESSION_KEY = 9999;
export const START = Date.parse('2024-05-05T13:00:00.000Z');

/**
 * Replay time at which the fixture's first lap begins. The engine opens its window a
 * lead-in before the first lap, so tests express offsets relative to this instant
 * rather than to the session slot.
 */
export const RACE_START = 300_000;
/** Total replay length: 5 min lead-in, 184 s of running, then a 3 min trail-out. */
export const DURATION = 664_000;
const iso = (offsetMs: number) => new Date(START + offsetMs).toISOString();

/** A square 1 km circuit, in OpenF1 location units (decimetres). */
export function squareLap(driver: number, lapStartMs: number, lapMs: number, samples: number) {
  const perimeter = 10_000;
  return Array.from({ length: samples }, (_, i) => {
    const d = (i / samples) * perimeter;
    const side = Math.floor(d / 2500);
    const along = d % 2500;
    const corners: [number, number][] = [[0, 0], [2500, 0], [2500, 2500], [0, 2500]];
    const dirs: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const c = corners[side]!;
    const dir = dirs[side]!;
    return {
      date: iso(lapStartMs + (i / samples) * lapMs),
      driver_number: driver,
      x: c[0] + dir[0] * along,
      y: c[1] + dir[1] * along,
      z: 0,
      session_key: SESSION_KEY,
    };
  });
}

export const DRIVERS = [
  { driver_number: 1, name_acronym: 'VER', full_name: 'Max Verstappen', broadcast_name: 'M VERSTAPPEN', team_name: 'Red Bull Racing', team_colour: '3671C6', country_code: 'NED', headshot_url: null },
  { driver_number: 44, name_acronym: 'HAM', full_name: 'Lewis Hamilton', broadcast_name: 'L HAMILTON', team_name: 'Mercedes', team_colour: '27F4D2', country_code: 'GBR', headshot_url: null },
];

/**
 * An in-memory stand-in for the OpenF1 HTTP client: two drivers, three laps each, on a
 * square circuit. Deterministic, so timing assertions can be exact.
 */
export function fakeClient(): OpenF1Client {
  const locations = [
    ...squareLap(1, 0, 60_000, 120),
    ...squareLap(1, 60_000, 60_000, 120),
    ...squareLap(1, 120_000, 60_000, 120),
    ...squareLap(44, 1_000, 61_000, 120),
    ...squareLap(44, 62_000, 61_000, 120),
    ...squareLap(44, 123_000, 61_000, 120),
  ];

  const laps = [1, 44].flatMap((n) =>
    [0, 1, 2].map((i) => ({
      driver_number: n,
      lap_number: i + 1,
      date_start: iso(i * 60_000 + (n === 44 ? 1_000 : 0)),
      lap_duration: n === 1 ? 60 + i : 61 + i,
      duration_sector_1: 20,
      duration_sector_2: 20,
      duration_sector_3: n === 1 ? 20 + i : 21 + i,
      is_pit_out_lap: false,
      st_speed: 300,
    })),
  );

  const stub = {
    sessions: async () => [{
      session_key: SESSION_KEY, meeting_key: 1, session_name: 'Race', session_type: 'Race',
      date_start: iso(0), date_end: iso(180_000), circuit_key: 1, circuit_short_name: 'Testing',
      country_name: 'Testland', location: 'Test City', year: 2024, gmt_offset: '00:00:00',
    }],
    drivers: async () => DRIVERS,
    location: async (f: Record<string, unknown>) => {
      const from = f['date>='] ? Date.parse(String(f['date>='])) : -Infinity;
      const to = f['date<'] ? Date.parse(String(f['date<'])) : Infinity;
      const upto = f['date<='] ? Date.parse(String(f['date<='])) : Infinity;
      const driver = f['driver_number'] as number | undefined;
      return locations.filter((r) => {
        const t = Date.parse(r.date);
        return t >= from && t < to && t <= upto && (driver === undefined || r.driver_number === driver);
      });
    },
    carData: async () => [1, 44].flatMap((n) =>
      Array.from({ length: 30 }, (_, i) => ({
        date: iso(i * 6_000), driver_number: n, speed: 100 + i, throttle: i * 3,
        brake: i % 2 === 0 ? 0 : 100, n_gear: (i % 8) + 1, rpm: 9_000 + i * 50,
        drs: i > 20 ? 12 : 0,
      })).filter(() => true),
    ),
    laps: async () => laps,
    intervals: async () => [
      { date: iso(60_000), driver_number: 1, gap_to_leader: 0, interval: 0 },
      { date: iso(60_000), driver_number: 44, gap_to_leader: 1.5, interval: 1.5 },
      { date: iso(120_000), driver_number: 44, gap_to_leader: 3.2, interval: 3.2 },
    ],
    positions: async () => [
      { date: iso(0), driver_number: 1, position: 1 },
      { date: iso(0), driver_number: 44, position: 2 },
      { date: iso(120_000), driver_number: 44, position: 1 },
      { date: iso(120_000), driver_number: 1, position: 2 },
    ],
    stints: async () => [
      { driver_number: 1, stint_number: 1, compound: 'SOFT', lap_start: 1, lap_end: 3, tyre_age_at_start: 2 },
      { driver_number: 44, stint_number: 1, compound: 'MEDIUM', lap_start: 1, lap_end: 3, tyre_age_at_start: 0 },
    ],
    raceControl: async () => [
      { date: iso(30_000), category: 'Flag', flag: 'GREEN', message: 'GREEN LIGHT', lap_number: 1, driver_number: null, scope: 'Track', sector: null },
      { date: iso(90_000), category: 'Flag', flag: 'YELLOW', message: 'YELLOW IN SECTOR 2', lap_number: 2, driver_number: null, scope: 'Sector', sector: 2 },
    ],
    weather: async () => [
      { date: iso(0), air_temperature: 24, track_temperature: 40, humidity: 50, pressure: 1010, wind_speed: 1.2, wind_direction: 180, rainfall: 0 },
      { date: iso(120_000), air_temperature: 25, track_temperature: 42, humidity: 48, pressure: 1009, wind_speed: 1.4, wind_direction: 190, rainfall: 1 },
    ],
  };

  return stub as unknown as OpenF1Client;
}
