import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { SessionCatalog } from '../application/SessionCatalog.js';
import type { IDataProvider } from '../domain/IDataProvider.js';

export function buildRoutes(catalog: SessionCatalog, provider: IDataProvider): Router {
  const r = Router();

  r.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));

  r.get('/health', (_req, res) => {
    const snap = provider.snapshot();
    res.json({
      status: snap.state.loaded ? 'ok' : 'loading',
      provider: provider.name,
      loadingPct: snap.state.loadingPct,
      uptimeSec: Math.round(process.uptime()),
    });
  });

  r.get('/sessions', async (_req, res, next) => {
    try { res.json(await catalog.races()); } catch (err) { next(err); }
  });

  r.get('/circuits', async (_req, res, next) => {
    try { res.json(await catalog.circuits()); } catch (err) { next(err); }
  });

  r.get('/track', (_req, res) => {
    const { track } = provider.snapshot();
    if (!track) return res.status(404).json({ error: 'track geometry not built yet' });
    res.json(track);
  });

  return r;
}
