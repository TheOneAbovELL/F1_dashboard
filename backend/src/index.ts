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
import type { IDataProvider } from './domain/IDataProvider.js';

async function main(): Promise<void> {
  const catalog = new SessionCatalog(openf1);

  let sessionKey = config.REPLAY_SESSION_KEY;
  if (!sessionKey) {
    const recent = await catalog.mostRecent();
    if (!recent) throw new Error('no completed race sessions available from OpenF1');
    sessionKey = recent.sessionKey;
    log.boot.info(
      { circuit: recent.circuitShortName, year: recent.year, sessionKey },
      'auto-selected most recent completed race',
    );
  }

  const provider: IDataProvider = new ReplayEngine(openf1, sessionKey);

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(compression());
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', buildRoutes(catalog, provider));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log.boot.error({ err }, 'unhandled request error');
    res.status(500).json({ error: 'internal error' });
  });

  const http = createServer(app);
  const io = attachSocket(http, provider);

  http.listen(config.PORT, () => {
    log.boot.info({ port: config.PORT, provider: provider.name }, 'backend listening');
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
