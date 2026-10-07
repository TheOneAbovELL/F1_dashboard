import { useEffect, useRef, useState } from 'react';
import { useRaceStore } from '../../store/useRaceStore.js';
import { CoordinateMapper } from '../../utils/coordinateMapper.js';
import { CarSymbols } from './F1Car.js';
import { CarLayer } from './CarLayer.js';
import { TrackPath } from './TrackPath.js';

interface Props {
  showLabels?: boolean;
  showTrails?: boolean;
  showSectors?: boolean;
  showCorners?: boolean;
  rotation?: number;
}

export function TrackMap({
  showLabels = true,
  showTrails = true,
  showSectors = true,
  showCorners = false,
  rotation = 0,
}: Props) {
  const track = useRaceStore((s) => s.track);
  const replay = useRaceStore((s) => s.replay);
  const status = useRaceStore((s) => s.status);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapperRef = useRef(new CoordinateMapper());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    mapperRef.current.setViewport({
      width: size.w,
      height: size.h,
      padding: Math.max(28, Math.min(72, size.w * 0.06)),
      rotation,
      flipY: true,
    });
    setRevision((r) => r + 1);
  }, [size.w, size.h, rotation]);

  useEffect(() => {
    if (!track) return;
    mapperRef.current.setBounds(track.bounds);
    setRevision((r) => r + 1);
  }, [track]);

  const loading = !track || !replay.loaded;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-xl border border-f1-border"
      style={{ background: 'radial-gradient(ellipse at 50% 42%, #15152a 0%, #08080f 74%)' }}
    >
      <svg width={size.w} height={size.h} className="block" aria-label="Circuit map">
        <defs>
          <filter id="track-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <linearGradient id="asphalt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#474757" />
            <stop offset="100%" stopColor="#2E2E3C" />
          </linearGradient>
          <radialGradient id="vignette" cx="50%" cy="46%" r="72%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.62" />
          </radialGradient>
        </defs>

        <CarSymbols />

        {track && size.w > 0 && (
          <TrackPath
            track={track}
            mapper={mapperRef.current}
            showSectors={showSectors}
            showCorners={showCorners}
            revision={revision}
          />
        )}

        {track && size.w > 0 && (
          <CarLayer mapper={mapperRef.current} showLabels={showLabels} showTrails={showTrails} />
        )}

        <rect width={size.w} height={size.h} fill="url(#vignette)" pointerEvents="none" />
      </svg>

      {track && (
        <div className="pointer-events-none absolute left-4 top-3">
          <div className="text-lg font-extrabold tracking-[0.1em] drop-shadow-lg">
            {track.circuitShortName.toUpperCase()}
          </div>
          <div className="label mt-1">
            {(track.lengthM / 1000).toFixed(3)} KM · {track.corners.length} CORNERS
          </div>
        </div>
      )}

      {loading && (
        <LoadingOverlay pct={replay.loadingPct} status={status} error={replay.error} />
      )}
    </div>
  );
}

function LoadingOverlay({
  pct,
  status,
  error,
}: {
  pct: number;
  status: string;
  error: string | null;
}) {
  if (error) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-f1-void/80 p-6 backdrop-blur-sm">
        <div className="max-w-sm text-center" role="alert">
          <div className="label mb-2 text-f1-red">Race data could not be loaded</div>
          <p className="text-[11px] leading-relaxed text-f1-dim">{error}</p>
          <p className="mt-3 text-[10.5px] leading-relaxed text-f1-dimmer">
            The backend reached OpenF1 but could not build this session. Check the backend
            log, then restart it — optionally with a different REPLAY_SESSION_KEY.
          </p>
        </div>
      </div>
    );
  }

  const message =
    status === 'offline' ? 'Cannot reach the backend'
      : status === 'reconnecting' ? 'Reconnecting…'
      : pct > 0 ? 'Loading race data from OpenF1'
      : 'Waiting for the backend';

  return (
    <div className="absolute inset-0 grid place-items-center bg-f1-void/70 backdrop-blur-sm">
      <div className="w-72 text-center">
        <div className="label mb-3">{message}</div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-f1-red transition-[width] duration-500"
            style={{ width: `${Math.max(3, pct)}%` }}
          />
        </div>
        <div className="mt-3 font-mono text-[11px] text-f1-dim">{Math.round(pct)}%</div>
        {pct > 0 && pct < 100 && (
          <p className="mt-4 text-[11px] leading-relaxed text-f1-dimmer">
            First load fetches the full session. Subsequent starts come from cache.
          </p>
        )}
      </div>
    </div>
  );
}
