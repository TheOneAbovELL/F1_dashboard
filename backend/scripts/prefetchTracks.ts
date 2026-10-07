import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openf1 } from '../src/infrastructure/openf1/client.js';
import { SessionCatalog } from '../src/application/SessionCatalog.js';
import { buildTrackGeometry } from '../src/infrastructure/track/trackBuilder.js';

// Resolved from this file rather than the working directory, so the script behaves the
// same however it is invoked.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'frontend', 'src', 'assets', 'tracks');

async function main() {
  await mkdir(OUT, { recursive: true });
  const circuits = await new SessionCatalog(openf1).circuits();
  console.log(`${circuits.length} circuits to build\n`);

  const index: { circuit: string; country: string; file: string; lengthM: number; corners: number }[] = [];

  for (const c of circuits) {
    try {
      const geo = await buildTrackGeometry(openf1, c.sessionKey, c.circuitShortName);
      const file = `${c.circuitShortName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
      await writeFile(join(OUT, file), JSON.stringify(geo));
      index.push({ circuit: c.circuitShortName, country: c.country, file,
                   lengthM: Math.round(geo.lengthM), corners: geo.corners.length });
      console.log(`✓ ${c.circuitShortName.padEnd(22)} ${Math.round(geo.lengthM)} m · ${geo.corners.length} corners`);
    } catch (err) {
      console.log(`✗ ${c.circuitShortName.padEnd(22)} ${(err as Error).message}`);
    }
  }

  await writeFile(join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`\nwrote ${index.length} circuits to ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
