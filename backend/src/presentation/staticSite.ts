import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import { config } from '../config/index.js';
import { log } from '../infrastructure/logger.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Candidate locations for the built frontend, newest layout first: the container image
 * copies it next to the compiled server, a checkout keeps it in the sibling project.
 */
const candidates = (): string[] => {
  const configured = config.FRONTEND_DIST_DIR;
  return [
    ...(configured ? [resolve(configured)] : []),
    resolve(here, '../public'),
    resolve(here, '../../../frontend/dist'),
  ];
};

export function resolveFrontendDist(): string | null {
  return candidates().find((dir) => existsSync(join(dir, 'index.html'))) ?? null;
}

/**
 * Serves the single-page app when a build is present. Hashed assets are immutable;
 * `index.html` must not be cached or clients pin themselves to a stale bundle.
 */
export function serveFrontend(app: Express): boolean {
  const dist = resolveFrontendDist();
  if (!dist) {
    log.boot.info('no frontend build found; serving the API only');
    return false;
  }

  app.use(
    express.static(dist, {
      index: false,
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, path) => {
        if (path.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );

  app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(dist, 'index.html'));
  });

  log.boot.info({ dist }, 'serving frontend build');
  return true;
}
