import { setTimeout as sleep } from 'node:timers/promises';
import { config } from '../../config/index.js';
import { log } from '../logger.js';
import { DiskCache } from '../cache/diskCache.js';
import type {
  RawCarData, RawDriver, RawInterval, RawLap, RawLocation,
  RawPosition, RawRaceControl, RawSession, RawStint, RawWeather,
} from './types.js';

export type Filters = Record<string, string | number | boolean | undefined>;

interface GetOptions {
  cache?: boolean;
  retries?: number;
}

export class OpenF1Client {
  private readonly cache = new DiskCache(config.OPENF1_CACHE_DIR);
  private readonly minIntervalMs = 1000 / config.OPENF1_REQUESTS_PER_SECOND;
  private queue: Promise<unknown> = Promise.resolve();
  private lastCallAt = 0;
  private token: { value: string; expiresAt: number } | null = null;

  private schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = this.minIntervalMs - (Date.now() - this.lastCallAt);
      if (wait > 0) await sleep(wait);
      this.lastCallAt = Date.now();
      return fn();
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private buildUrl(path: string, filters: Filters): string {
    const parts: string[] = [];
    for (const [rawKey, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      const match = /^(.*?)(>=|<=|>|<|=)?$/.exec(rawKey);
      const key = match?.[1] ?? rawKey;
      const op = match?.[2] ?? '=';
      parts.push(`${encodeURIComponent(key)}${op}${encodeURIComponent(String(value))}`);
    }
    return `${config.OPENF1_BASE_URL}/${path}${parts.length ? `?${parts.join('&')}` : ''}`;
  }

  private async authHeader(): Promise<Record<string, string>> {
    if (config.DATA_PROVIDER !== 'live') return {};
    if (this.token && Date.now() < this.token.expiresAt) {
      return { Authorization: `Bearer ${this.token.value}` };
    }
    const body = new URLSearchParams({
      username: config.OPENF1_USERNAME ?? '',
      password: config.OPENF1_PASSWORD ?? '',
    });
    const res = await fetch('https://api.openf1.org/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error(`token request failed: ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in: string | number };
    const ttl = Number(json.expires_in) || 3600;
    this.token = { value: json.access_token, expiresAt: Date.now() + (ttl - 60) * 1000 };
    log.api.info('obtained OpenF1 access token');
    return { Authorization: `Bearer ${this.token.value}` };
  }

  async get<T>(path: string, filters: Filters = {}, opts: GetOptions = {}): Promise<T[]> {
    const url = this.buildUrl(path, filters);

    if (opts.cache) {
      const hit = await this.cache.get<T[]>(url);
      if (hit) return hit;
    }

    const maxRetries = opts.retries ?? 4;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const data = await this.schedule(async () => {
          const ctl = new AbortController();
          const timer = setTimeout(() => ctl.abort(), config.OPENF1_TIMEOUT_MS);
          try {
            const res = await fetch(url, {
              signal: ctl.signal,
              headers: { accept: 'application/json', ...(await this.authHeader()) },
            });
            if (res.status === 429) throw new RetryableError('rate limited', 429);
            if (res.status >= 500) throw new RetryableError(`upstream ${res.status}`, res.status);
            if (!res.ok) throw new Error(`OpenF1 ${res.status} for ${path}`);
            const json = await res.json();
            if (!Array.isArray(json)) throw new Error(`expected an array from ${path}`);
            return json as T[];
          } finally {
            clearTimeout(timer);
          }
        });

        if (opts.cache) await this.cache.set(url, data);
        return data;
      } catch (err) {
        lastError = err;
        const retryable = err instanceof RetryableError || isAbort(err) || isNetworkError(err);
        if (!retryable || attempt === maxRetries) break;
        const backoff = Math.min(16_000, 800 * 2 ** attempt) + Math.random() * 400;
        log.api.warn({ path, attempt, backoff }, 'retrying OpenF1 request');
        await sleep(backoff);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`OpenF1 request failed: ${path}`);
  }

  sessions(f: Filters) { return this.get<RawSession>('sessions', f, { cache: true }); }
  drivers(f: Filters) { return this.get<RawDriver>('drivers', f, { cache: true }); }
  location(f: Filters) { return this.get<RawLocation>('location', f, { cache: true }); }
  carData(f: Filters) { return this.get<RawCarData>('car_data', f, { cache: true }); }
  laps(f: Filters) { return this.get<RawLap>('laps', f, { cache: true }); }
  intervals(f: Filters) { return this.get<RawInterval>('intervals', f, { cache: true }); }
  positions(f: Filters) { return this.get<RawPosition>('position', f, { cache: true }); }
  stints(f: Filters) { return this.get<RawStint>('stints', f, { cache: true }); }
  raceControl(f: Filters) { return this.get<RawRaceControl>('race_control', f, { cache: true }); }
  weather(f: Filters) { return this.get<RawWeather>('weather', f, { cache: true }); }
}

class RetryableError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';
const isNetworkError = (e: unknown) =>
  e instanceof TypeError || (e instanceof Error && /fetch failed|ECONN|ENOTFOUND/i.test(e.message));

export const openf1 = new OpenF1Client();
