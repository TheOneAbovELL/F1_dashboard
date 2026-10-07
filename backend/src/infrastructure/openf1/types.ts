export interface RawSession {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  circuit_key: number;
  circuit_short_name: string;
  country_name: string;
  location: string;
  year: number;
  gmt_offset: string;
}

export interface RawDriver {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  broadcast_name: string;
  team_name: string;
  team_colour: string | null;
  country_code: string | null;
  headshot_url: string | null;
}

export interface RawLocation {
  date: string;
  driver_number: number;
  x: number;
  y: number;
  z: number;
  session_key: number;
}

export interface RawCarData {
  date: string;
  driver_number: number;
  speed: number;
  throttle: number;
  brake: number;
  n_gear: number;
  rpm: number;
  drs: number;
}

export interface RawLap {
  driver_number: number;
  lap_number: number;
  date_start: string | null;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  is_pit_out_lap: boolean;
  st_speed: number | null;
}

export interface RawInterval {
  date: string;
  driver_number: number;
  gap_to_leader: number | string | null;
  interval: number | string | null;
}

export interface RawPosition {
  date: string;
  driver_number: number;
  position: number;
}

export interface RawStint {
  driver_number: number;
  stint_number: number;
  compound: string | null;
  lap_start: number;
  lap_end: number;
  tyre_age_at_start: number | null;
}

export interface RawRaceControl {
  date: string;
  category: string;
  flag: string | null;
  message: string;
  lap_number: number | null;
  driver_number: number | null;
  scope: string | null;
  sector: number | null;
}

export interface RawWeather {
  date: string;
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  wind_direction: number;
  rainfall: number;
}
