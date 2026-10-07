import { io, type Socket } from 'socket.io-client';
import type {
  CarPosition,
  ConnectionStatus,
  Driver,
  LeaderboardEntry,
  RaceControlMessage,
  ReplayState,
  Session,
  Telemetry,
  TrackGeometry,
  Weather,
} from '../types/index.js';

interface ServerEvents {
  'session:update': (s: Session) => void;
  'drivers:update': (d: Driver[]) => void;
  'track:update': (t: TrackGeometry) => void;
  'positions:update': (p: { positions: CarPosition[]; tMs: number }) => void;
  'timing:update': (p: { leaderboard: LeaderboardEntry[] }) => void;
  'telemetry:update': (p: { driverNumber: number; telemetry: Telemetry }) => void;
  'weather:update': (w: Weather) => void;
  'race:control': (m: RaceControlMessage[]) => void;
  'replay:state': (s: ReplayState) => void;
}

interface ClientEvents {
  'subscribe:driver': (n: number) => void;
  'unsubscribe:driver': (n: number) => void;
  'replay:play': () => void;
  'replay:pause': () => void;
  'replay:speed': (m: number) => void;
  'replay:seek': (tMs: number) => void;
}

type Handlers = Partial<ServerEvents> & { status?: (s: ConnectionStatus) => void };

class SocketService {
  private socket: Socket<ServerEvents, ClientEvents> | null = null;
  private handlers: Handlers = {};
  private subscribed = new Set<number>();

  connect(handlers: Handlers): void {
    this.handlers = handlers;
    if (this.socket) return;

    const url = import.meta.env.VITE_BACKEND_URL ?? '/';
    this.socket = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      reconnectionDelayMax: 8_000,
      timeout: 12_000,
    });

    this.handlers.status?.('connecting');

    this.socket.on('connect', () => {
      this.handlers.status?.('connected');
      for (const n of this.subscribed) this.socket?.emit('subscribe:driver', n);
    });

    this.socket.on('disconnect', () => this.handlers.status?.('reconnecting'));
    this.socket.io.on('reconnect_failed', () => this.handlers.status?.('offline'));

    const forward = <K extends keyof ServerEvents>(event: K) => {
      this.socket?.on(event as any, ((payload: any) => {
        (this.handlers[event] as ((p: any) => void) | undefined)?.(payload);
      }) as any);
    };

    forward('session:update');
    forward('drivers:update');
    forward('track:update');
    forward('positions:update');
    forward('timing:update');
    forward('telemetry:update');
    forward('weather:update');
    forward('race:control');
    forward('replay:state');
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.subscribed.clear();
  }

  subscribeDriver(n: number): void {
    if (this.subscribed.has(n)) return;
    this.subscribed.add(n);
    this.socket?.emit('subscribe:driver', n);
  }

  unsubscribeDriver(n: number): void {
    if (!this.subscribed.delete(n)) return;
    this.socket?.emit('unsubscribe:driver', n);
  }

  play() { this.socket?.emit('replay:play'); }
  pause() { this.socket?.emit('replay:pause'); }
  setSpeed(m: number) { this.socket?.emit('replay:speed', m); }
  seek(tMs: number) { this.socket?.emit('replay:seek', tMs); }
}

export const socketService = new SocketService();
