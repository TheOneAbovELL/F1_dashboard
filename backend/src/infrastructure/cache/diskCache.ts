import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { log } from '../logger.js';

export class DiskCache {
  constructor(private readonly root: string) {}

  private pathFor(key: string): string {
    const hash = createHash('sha1').update(key).digest('hex');
    return join(this.root, hash.slice(0, 2), `${hash.slice(2)}.json.gz`);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const buf = await readFile(this.pathFor(key));
      return JSON.parse(gunzipSync(buf).toString('utf8')) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    const file = this.pathFor(key);
    try {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, gzipSync(Buffer.from(JSON.stringify(value), 'utf8')));
    } catch (err) {
      log.api.warn({ err }, 'cache write failed');
    }
  }
}
