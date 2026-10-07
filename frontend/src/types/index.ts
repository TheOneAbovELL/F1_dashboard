export interface Session {
  sessionKey: number;
  name: string;
  type: string;
  circuitShortName: string;
  country: string;
  location: string;
  year: number;
  startMs: number;
  endMs: number;
  totalLaps: number | null;
}

export interface Driver {
  number: number;
  acronym: string;
  fullName: string;
  team: string;
  colour: string;
  countryCode: string | null;
  headshot: string | null;
}

export interface CarPosition {
  n: number;
  x: number;
  y: number;
  h: number;
  q: number;
}

export interface LeaderboardEntry {
  n: number;
  position: number;
  gapToLeader: number | null;
  interval: number | null;
  lapNumber: number;
  lastLap: number | null;
  bestLap: number | null;
  sectors: [number | null, number | null, number | null];
  compound: string | null;
  tyreAge: number;
  inPit: boolean;
  retired: boolean;
}

export interface Telemetry {
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  rpm: number;
  drs: boolean;
}

export interface Weather {
  airTemp: number;
  trackTemp: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  rainfall: number;
}

export interface RaceControlMessage {
  tMs: number;
  category: string;
  flag: string | null;
  message: string;
  lap: number | null;
  driverNumber: number | null;
  scope: string | null;
}

export interface TrackBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface TrackGeometry {
  circuitShortName: string;
  sessionKey: number;
  points: [number, number][];
  cumulative: number[];
  lengthM: number;
  bounds: TrackBounds;
  sectorSplits: [number, number, number];
  drsZones: [number, number][];
  corners: number[];
  builtAt: string;
}

export interface ReplayState {
  loaded: boolean;
  loadingPct: number;
  playing: boolean;
  speed: number;
  tMs: number;
  durationMs: number;
  /** Set when the backend could not load the race; shown instead of a stuck spinner. */
  error: string | null;
}

export interface DriverStanding {
  driverId: string;
  name: string;
  team: string;
  positionText: string;
  gapToLeader?: number;
}

export interface RaceEvent {
  id: string;
  type: string;
  message: string;
  sector: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';
