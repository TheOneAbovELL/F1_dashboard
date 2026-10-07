import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  base: undefined,
  transport:
    config.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
  redact: ['password', 'token', 'access_token', 'authorization', '*.password', '*.token'],
});

export const log = {
  boot: logger.child({ mod: 'boot' }),
  api: logger.child({ mod: 'openf1' }),
  replay: logger.child({ mod: 'replay' }),
  track: logger.child({ mod: 'track' }),
  socket: logger.child({ mod: 'socket' }),
};
