/**
 * OpenF1 `location` samples are expressed in a Cartesian grid whose unit is one
 * decimetre, not one metre. Everything downstream of ingest — track length, corner
 * radii, DRS zone lengths, car sizing on screen — assumes metres, so raw coordinates
 * are converted exactly once, as they enter the domain.
 */
export const OPENF1_UNITS_PER_METRE = 10;

export const toMetres = (units: number): number => units / OPENF1_UNITS_PER_METRE;
