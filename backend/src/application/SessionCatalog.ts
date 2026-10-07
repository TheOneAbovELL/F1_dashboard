import type { OpenF1Client } from '../infrastructure/openf1/client.js';
import type { Session } from '../domain/models.js';
import { log } from '../infrastructure/logger.js';

const FIRST_YEAR = 2023;

export class SessionCatalog {
  private cache: Session[] | null = null;

  constructor(private readonly client: OpenF1Client) {}

  async races(): Promise<Session[]> {
    if (this.cache) return this.cache;

    const thisYear = new Date().getUTCFullYear();
    const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
    const all: Session[] = [];

    for (const year of years) {
      try {
        const raw = await this.client.sessions({ year, session_type: 'Race' });
        for (const s of raw) {
          const endMs = Date.parse(s.date_end);
          if (!Number.isFinite(endMs) || endMs > Date.now()) continue;
          all.push({
            sessionKey: s.session_key,
            name: s.session_name,
            type: s.session_type,
            circuitShortName: s.circuit_short_name,
            country: s.country_name,
            location: s.location,
            year: s.year,
            startMs: Date.parse(s.date_start),
            endMs,
            totalLaps: null,
          });
        }
      } catch (err) {
        log.api.warn({ err, year }, 'failed to list sessions for year');
      }
    }

    all.sort((a, b) => b.startMs - a.startMs);
    this.cache = all;
    log.api.info({ count: all.length }, 'session catalogue built');
    return all;
  }

  async mostRecent(): Promise<Session | null> {
    return (await this.races())[0] ?? null;
  }

  async circuits(): Promise<{ circuitShortName: string; country: string; sessionKey: number; year: number }[]> {
    const seen = new Map<string, Session>();
    for (const s of await this.races()) {
      if (!seen.has(s.circuitShortName)) seen.set(s.circuitShortName, s);
    }
    return [...seen.values()].map((s) => ({
      circuitShortName: s.circuitShortName,
      country: s.country,
      sessionKey: s.sessionKey,
      year: s.year,
    }));
  }
}
