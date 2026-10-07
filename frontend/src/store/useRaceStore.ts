import { create } from 'zustand';
import type {
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
import { AnimationEngine } from '../utils/animationEngine.js';
import { socketService } from '../services/socket.js';

export const animationEngine = new AnimationEngine();

interface RaceState {
  status: ConnectionStatus;
  session: Session | null;
  drivers: Driver[];
  driversByNumber: Map<number, Driver>;
  track: TrackGeometry | null;
  leaderboard: LeaderboardEntry[];
  telemetry: Map<number, Telemetry>;
  weather: Weather | null;
  messages: RaceControlMessage[];
  replay: ReplayState;
  selectedDriver: number | null;

  connect(): void;
  selectDriver(n: number | null): void;
}

const initialReplay: ReplayState = {
  loaded: false,
  loadingPct: 0,
  playing: false,
  speed: 1,
  tMs: 0,
  durationMs: 0,
};

export const useRaceStore = create<RaceState>((set, get) => ({
  status: 'connecting',
  session: null,
  drivers: [],
  driversByNumber: new Map(),
  track: null,
  leaderboard: [],
  telemetry: new Map(),
  weather: null,
  messages: [],
  replay: initialReplay,
  selectedDriver: null,

  connect() {
    socketService.connect({
      status: (status) => {
        if (status === 'reconnecting' || status === 'offline') animationEngine.reset();
        set({ status });
      },
      'session:update': (session) => set({ session }),
      'drivers:update': (drivers) => set({ drivers, driversByNumber: new Map(drivers.map((d) => [d.number, d])) }),
      'track:update': (track) => set({ track }),
      'positions:update': ({ positions, tMs }) => animationEngine.push(positions, tMs),
      'timing:update': ({ leaderboard }) => set({ leaderboard }),
      'telemetry:update': ({ driverNumber, telemetry }) => {
        const next = new Map(get().telemetry);
        next.set(driverNumber, telemetry);
        set({ telemetry: next });
      },
      'weather:update': (weather) => set({ weather }),
      'race:control': (messages) => set({ messages }),
      'replay:state': (replay) => {
        const prev = get().replay;
        if (replay.tMs < prev.tMs - 1000) animationEngine.reset();
        set({ replay });
      },
    });
  },

  selectDriver(n) {
    const prev = get().selectedDriver;
    if (prev !== null && prev !== n) socketService.unsubscribeDriver(prev);
    if (n !== null) socketService.subscribeDriver(n);
    set({ selectedDriver: n });
  },
}));
