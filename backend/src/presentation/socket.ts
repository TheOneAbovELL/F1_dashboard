import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import type { DataSink, IDataProvider } from '../domain/IDataProvider.js';
import { corsOrigins } from '../config/index.js';
import { log } from '../infrastructure/logger.js';

const DriverNumber = z.number().int().min(1).max(99);
const Speed = z.number().min(0.1).max(20);
const SeekMs = z.number().int().min(0).max(6 * 60 * 60 * 1000);

export function attachSocket(http: HttpServer, provider: IDataProvider): Server {
  const io = new Server(http, {
    cors: { origin: corsOrigins, methods: ['GET', 'POST'] },
    perMessageDeflate: { threshold: 2048 },
  });

  const sink: DataSink = {
    session: (s) => io.emit('session:update', s),
    drivers: (d) => io.emit('drivers:update', d),
    track: (t) => io.emit('track:update', t),
    positions: (p, tMs) => io.volatile.emit('positions:update', { positions: p, tMs }),
    timing: (l) => io.emit('timing:update', { leaderboard: l }),
    telemetry: (n, t) => io.to(`tel:${n}`).volatile.emit('telemetry:update', { driverNumber: n, telemetry: t }),
    weather: (w) => io.emit('weather:update', w),
    raceControl: (m) => io.emit('race:control', m),
    state: (s) => io.emit('replay:state', s),
  };

  io.on('connection', (socket) => {
    log.socket.debug({ id: socket.id }, 'client connected');

    const snap = provider.snapshot();
    if (snap.session) socket.emit('session:update', snap.session);
    if (snap.drivers.length) socket.emit('drivers:update', snap.drivers);
    if (snap.track) socket.emit('track:update', snap.track);
    socket.emit('replay:state', snap.state);

    socket.on('subscribe:driver', async (raw: unknown) => {
      const parsed = DriverNumber.safeParse(raw);
      if (!parsed.success) return;
      await socket.join(`tel:${parsed.data}`);
      await provider.subscribeTelemetry?.(parsed.data);
    });

    socket.on('unsubscribe:driver', async (raw: unknown) => {
      const parsed = DriverNumber.safeParse(raw);
      if (!parsed.success) return;
      await socket.leave(`tel:${parsed.data}`);
      const room = io.sockets.adapter.rooms.get(`tel:${parsed.data}`);
      if (!room || room.size === 0) provider.unsubscribeTelemetry?.(parsed.data);
    });

    socket.on('replay:play', () => provider.play?.());
    socket.on('replay:pause', () => provider.pause?.());
    socket.on('replay:speed', (raw: unknown) => {
      const p = Speed.safeParse(raw);
      if (p.success) provider.setSpeed?.(p.data);
    });
    socket.on('replay:seek', (raw: unknown) => {
      const p = SeekMs.safeParse(raw);
      if (p.success) provider.seek?.(p.data);
    });

    socket.on('disconnect', () => log.socket.debug({ id: socket.id }, 'client disconnected'));
  });

  void provider.start(sink);
  return io;
}
