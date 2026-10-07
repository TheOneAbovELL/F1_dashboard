import { useMemo } from 'react';
import type { TrackGeometry } from '../../types/index.js';
import type { CoordinateMapper } from '../../utils/coordinateMapper.js';

const SECTOR_COLOURS = ['#5B6BFF', '#00C2A8', '#FFB400'] as const;

interface Props {
  track: TrackGeometry;
  mapper: CoordinateMapper;
  showSectors: boolean;
  showCorners: boolean;
  revision: number;
}

export function TrackPath({ track, mapper, showSectors, showCorners, revision }: Props) {
  const geom = useMemo(() => {
    if (!mapper.ready) return null;
    const projected = track.points.map((p) => mapper.project(p[0], p[1]));
    const toPath = (pts: [number, number][], close: boolean) =>
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('') +
      (close ? 'Z' : '');

    const sectorPaths: string[] = [];
    let cursor = 0;
    for (let s = 0; s < 3; s++) {
      const limit = track.sectorSplits[s]!;
      const slice: [number, number][] = [];
      while (cursor < projected.length && track.cumulative[cursor]! <= limit) {
        slice.push(projected[cursor]!);
        cursor++;
      }
      if (slice.length > 1) sectorPaths.push(toPath(slice, false));
    }

    const drsPaths = track.drsZones.map(([from, to]) => {
      const slice = projected.filter((_, i) => {
        const d = track.cumulative[i]!;
        return from < to ? d >= from && d <= to : d >= from || d <= to;
      });
      return toPath(slice, false);
    });

    const startIdx = 0;
    const next = projected[8] ?? projected[1]!;
    const start = projected[startIdx]!;
    const angle = (Math.atan2(next[1] - start[1], next[0] - start[0]) * 180) / Math.PI;

    return {
      full: toPath(projected, true),
      sectorPaths,
      drsPaths,
      start,
      angle,
      cornerPoints: track.corners.map((i) => projected[i]).filter(Boolean) as [number, number][],
    };
  }, [track, mapper, revision]);

  if (!geom) return null;

  return (
    <g>
      <g transform="translate(3 12)" opacity="0.6" filter="url(#track-soft)">
        <path d={geom.full} fill="none" stroke="#000" strokeWidth="38" strokeLinejoin="round" />
      </g>

      <path d={geom.full} fill="none" stroke="#55556A" strokeWidth="30" strokeLinejoin="round" />
      <path d={geom.full} fill="none" stroke="url(#asphalt)" strokeWidth="27.5" strokeLinejoin="round" />
      <path d={geom.full} fill="none" stroke="#D8D8E4" strokeWidth="24" strokeLinejoin="round" opacity="0.45" />
      <path d={geom.full} fill="none" stroke="#16161F" strokeWidth="22" strokeLinejoin="round" />
      <path d={geom.full} fill="none" stroke="#000" strokeWidth="10" strokeLinejoin="round" opacity="0.2" />

      {showSectors &&
        geom.sectorPaths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={SECTOR_COLOURS[i]}
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.55"
          />
        ))}

      {geom.drsPaths.map((d, i) => (
        <path key={`drs-${i}`} d={d} fill="none" stroke="#2BD47D" strokeWidth="22" opacity="0.12" />
      ))}

      {showCorners &&
        geom.cornerPoints.map((p, i) => (
          <g key={`c-${i}`} transform={`translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`}>
            <circle r="8.5" fill="#0B0B13" stroke="#2E2E42" strokeWidth="1" />
            <text
              y="3"
              textAnchor="middle"
              className="font-mono text-[8px] font-bold"
              fill="#9A9AB8"
            >
              {i + 1}
            </text>
          </g>
        ))}

      <g transform={`translate(${geom.start[0].toFixed(1)} ${geom.start[1].toFixed(1)}) rotate(${geom.angle.toFixed(1)})`}>
        {Array.from({ length: 12 }, (_, i) => {
          const row = i % 2;
          const col = Math.floor(i / 2) - 3;
          return (
            <rect
              key={i}
              x={row * 3.8 - 1.9}
              y={col * 3.8}
              width="3.8"
              height="3.8"
              fill={(row + col) % 2 === 0 ? '#FFFFFF' : '#101018'}
            />
          );
        })}
      </g>
    </g>
  );
}
