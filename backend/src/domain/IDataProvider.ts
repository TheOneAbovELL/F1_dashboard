import type {
  CarPosition, Driver, LeaderboardEntry, RaceControlMessage,
  ReplayState, Session, Telemetry, TrackGeometry, Weather,
} from './models.js';

export interface DataSink {
  session(s: Session): void;
  drivers(d: Driver[]): void;
  track(t: TrackGeometry): void;
  positions(p: CarPosition[], tMs: number): void;
  timing(l: LeaderboardEntry[]): void;
  telemetry(driverNumber: number, t: Telemetry): void;
  weather(w: Weather): void;
  raceControl(m: RaceControlMessage[]): void;
  state(s: ReplayState): void;
}

export interface IDataProvider {
  readonly name: string;
  init(): Promise<void>;
  start(sink: DataSink): Promise<void>;
  stop(): Promise<void>;
  subscribeTelemetry?(driverNumber: number): Promise<void>;
  unsubscribeTelemetry?(driverNumber: number): void;
  play?(): void;
  pause?(): void;
  seek?(tMs: number): void;
  setSpeed?(multiplier: number): void;
  snapshot(): {
    session: Session | null; drivers: Driver[];
    track: TrackGeometry | null; state: ReplayState;
  };
}
