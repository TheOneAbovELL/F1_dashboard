import { createServer } from 'node:http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { config, corsOrigins } from './config/index.js';
import { log } from './infrastructure/logger.js';
import { openf1 } from './infrastructure/openf1/client.js';
import { SessionCatalog } from './application/SessionCatalog.js';
import { ReplayEngine } from './application/ReplayEngine.js';
import { buildRoutes } from './presentation/routes.js';
import { attachSocket } from './presentation/socket.js';
import { serveFrontend } from './presentation/staticSite.js';
import type { IDataProvider } from './domain/IDataProvider.js';

async function main(): Promise<void> {
  const catalog = new SessionCatalog(openf1);

  // The engine resolves the session itself. Nothing here awaits OpenF1, so the server
  // always reaches the point of listening and can report an upstream failure through
  // /api/health instead of dying before it opens a port.
  const provider: IDataProvider = new ReplayEngine(
    openf1,
    config.REPLAY_SESSION_KEY ?? null,
    catalog,
  );

  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      // The bundle is same-origin; fonts and their stylesheet come from Google Fonts,
      // and driver headshots are hotlinked from the F1 media CDN over https.
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:', 'https:'],
          'connect-src': ["'self'", 'ws:', 'wss:'],
          'upgrade-insecure-requests': null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cors({ origin: corsOrigins }));
  app.use(compression());
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', buildRoutes(catalog, provider));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

  serveFrontend(app);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log.boot.error({ err }, 'unhandled request error');
    res.status(500).json({ error: 'internal error' });
  });

  const http = createServer(app);
  const { io, sink } = attachSocket(http, provider);

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(config.PORT, () => {
      log.boot.info({ port: config.PORT, provider: provider.name }, 'backend listening');
      resolve();
    });
  });

  // Loading a whole race takes minutes on a cold cache, so the server accepts
  // connections first and streams progress. A failure here is terminal for the replay
  // but must not take the process down silently: clients are told, and /api/health
  // reports it.
  provider.start(sink).catch((err) => {
    log.boot.error({ err }, 'replay failed to load');
  });

  const shutdown = async (signal: string) => {
    log.boot.info({ signal }, 'shutting down');
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    await provider.stop();
    io.close();
    http.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => log.boot.error({ reason }, 'unhandled rejection'));
}

main().catch((err) => {
  log.boot.error({ err }, 'fatal boot error');
  process.exit(1);
});
