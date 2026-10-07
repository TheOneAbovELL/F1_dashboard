import { openf1 } from '../backend/src/infrastructure/openf1/client.js';

const need = (obj: unknown, fields: string[]) =>
  fields.map((f) => `${(obj as Record<string, unknown>)?.[f] !== undefined ? '✓' : '✗'} ${f}`).join('  ');

async function main() {
  console.log('→ sessions');
  const sessions = await openf1.sessions({ year: new Date().getUTCFullYear() - 1, session_type: 'Race' });
  console.log(`  ${sessions.length} rows`);
  console.log('  ' + need(sessions[0], ['session_key', 'circuit_short_name', 'date_start', 'date_end']));
  const key = sessions[0]?.session_key;
  if (!key) throw new Error('no sessions returned');

  console.log('→ drivers');
  const drivers = await openf1.drivers({ session_key: key });
  console.log(`  ${drivers.length} rows`);
  console.log('  ' + need(drivers[0], ['driver_number', 'name_acronym', 'team_name', 'team_colour']));

  console.log('→ laps');
  const laps = await openf1.laps({ session_key: key });
  console.log(`  ${laps.length} rows`);
  console.log('  ' + need(laps[0], ['lap_number', 'lap_duration', 'duration_sector_1', 'is_pit_out_lap']));

  const fast = laps.filter((l) => l.lap_duration && l.date_start && !l.is_pit_out_lap)
    .sort((a, b) => a.lap_duration! - b.lap_duration!)[0];
  if (fast) {
    console.log(`→ location (driver ${fast.driver_number}, one lap)`);
    const start = Date.parse(fast.date_start!);
    const loc = await openf1.location({
      session_key: key, driver_number: fast.driver_number,
      'date>=': new Date(start).toISOString(),
      'date<=': new Date(start + fast.lap_duration! * 1000).toISOString(),
    });
    console.log(`  ${loc.length} rows`);
    console.log('  ' + need(loc[0], ['date', 'x', 'y', 'z', 'driver_number']));
    if (loc.length < 80) console.log('  ⚠ too few samples to build a track outline from this lap');
  }

  console.log('→ car_data / intervals / position / stints / race_control / weather');
  for (const [name, fn, fields] of [
    ['car_data', () => openf1.carData({ session_key: key, driver_number: drivers[0]!.driver_number }), ['speed', 'throttle', 'brake', 'n_gear', 'rpm', 'drs']],
    ['intervals', () => openf1.intervals({ session_key: key }), ['gap_to_leader', 'interval']],
    ['position', () => openf1.positions({ session_key: key }), ['position', 'driver_number']],
    ['stints', () => openf1.stints({ session_key: key }), ['compound', 'lap_start', 'lap_end']],
    ['race_control', () => openf1.raceControl({ session_key: key }), ['category', 'message', 'flag']],
    ['weather', () => openf1.weather({ session_key: key }), ['air_temperature', 'track_temperature']],
  ] as const) {
    try {
      const rows = await fn();
      console.log(`  ${name}: ${rows.length} rows — ${need(rows[0], fields as unknown as string[])}`);
    } catch (err) {
      console.log(`  ${name}: FAILED — ${(err as Error).message}`);
    }
  }
  console.log('\ndone.');
}

main().catch((e) => { console.error(e); process.exit(1); });
