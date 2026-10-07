import 'dotenv/config';
import { z } from 'zod';

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  DATA_PROVIDER: z.enum(['replay', 'live']).default('replay'),
  REPLAY_SESSION_KEY: z.coerce.number().int().positive().optional(),
  REPLAY_SPEED: z.coerce.number().min(0.1).max(20).default(1),

  OPENF1_BASE_URL: z.string().url().default('https://api.openf1.org/v1'),
  OPENF1_REQUESTS_PER_SECOND: z.coerce.number().min(0.2).max(10).default(2.5),
  OPENF1_TIMEOUT_MS: z.coerce.number().int().min(1000).default(25_000),
  OPENF1_CACHE_DIR: z.string().default('.cache/openf1'),
  OPENF1_USERNAME: z.string().optional(),
  OPENF1_PASSWORD: z.string().optional(),

  LOAD_WINDOW_SECONDS: z.coerce.number().int().min(30).max(900).default(180),
  BROADCAST_HZ: z.coerce.number().int().min(1).max(30).default(10),
});

const parsed = Schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;

export const corsOrigins =
  config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(',').map((s) => s.trim());

if (config.DATA_PROVIDER === 'live' && !config.OPENF1_USERNAME) {
  console.error('DATA_PROVIDER=live requires OPENF1_USERNAME and OPENF1_PASSWORD.');
  process.exit(1);
}
