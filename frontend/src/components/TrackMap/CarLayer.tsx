import { useEffect, useMemo, useRef } from 'react';
import { useRaceStore, animationEngine } from '../../store/useRaceStore.js';
import { useAnimationFrame } from '../../hooks/useAnimationFrame.js';
import { buildLivery, isSecondCar } from '../../utils/livery.js';
import type { CoordinateMapper } from '../../utils/coordinateMapper.js';
import { CAR_HEIGHT, CAR_LENGTH } from './F1Car.js';

const CAR_LENGTH_M = 5.6;
/**
 * At true scale a car is about three pixels wide on a full-screen circuit map, which is
 * unreadable, so cars are drawn larger than life the way broadcast graphics do.
 */
const CAR_SCALE_EXAGGERATION = 4;
const MIN_CAR_PX = 11;
const MAX_CAR_PX = 26;
/** Below this the detailed car art is mush, so the simplified symbol is used instead. */
const LOD_THRESHOLD_PX = 13;

interface Props {
  mapper: CoordinateMapper;
  showLabels: boolean;
  showTrails: boolean;
}

export function CarLayer({ mapper, showLabels, showTrails }: Props) {
  const drivers = useRaceStore((s) => s.drivers);
  const selected = useRaceStore((s) => s.selectedDriver);
  const selectDriver = useRaceStore((s) => s.selectDriver);

  const nodes = useRef(new Map<number, {
    group: SVGGElement;
    car: SVGUseElement;
    label: SVGGElement | null;
    trail: SVGPolylineElement | null;
  }>());
  const trails = useRef(new Map<number, number[]>());
  const frame = useRef(0);
  const generation = useRef(animationEngine.generation);

  const teamNumbers = useMemo(() => {
    const byTeam = new Map<string, number[]>();
    for (const d of drivers) byTeam.set(d.team, [...(byTeam.get(d.team) ?? []), d.number]);
    return byTeam;
  }, [drivers]);

  useEffect(() => { trails.current.clear(); }, [showTrails]);

  useAnimationFrame(() => {
    if (!mapper.ready) return;
    const sampled = animationEngine.sample();
    frame.current++;

    // After a seek the cars are somewhere else entirely; keeping the old points would
    // draw a straight line across the circuit from the old position to the new one.
    if (generation.current !== animationEngine.generation) {
      generation.current = animationEngine.generation;
      trails.current.clear();
      for (const node of nodes.current.values()) node.trail?.setAttribute('points', '');
    }

    const pxPerCar = Math.min(
      MAX_CAR_PX,
      Math.max(MIN_CAR_PX, mapper.pxPerMetre * CAR_LENGTH_M * CAR_SCALE_EXAGGERATION),
    );
    const scale = pxPerCar / CAR_LENGTH;
    const useLod = pxPerCar < LOD_THRESHOLD_PX;

    for (const [n, node] of nodes.current) {
      // A car the backend is no longer reporting — not yet out, or retired — is hidden
      // rather than left parked at its last known position.
      if (!sampled.has(n)) {
        node.group?.setAttribute('visibility', 'hidden');
        node.label?.setAttribute('visibility', 'hidden');
        node.trail?.setAttribute('points', '');
        trails.current.delete(n);
      }
    }

    for (const [n, car] of sampled) {
      const node = nodes.current.get(n);
      if (!node?.group) continue;

      node.group.setAttribute('visibility', 'visible');
      node.label?.setAttribute('visibility', 'visible');

      const [px, py] = mapper.project(car.x, car.y);
      const deg = mapper.projectAngle(car.h);

      node.group.setAttribute(
        'transform',
        `translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${deg.toFixed(1)}) scale(${scale.toFixed(3)})`,
      );
      node.car.setAttribute('href', useLod ? '#f1-car-lod' : '#f1-car');
      node.group.setAttribute('opacity', car.q < 0.25 ? '0.35' : '1');

      if (node.label) {
        node.label.setAttribute(
          'transform',
          `translate(${px.toFixed(2)} ${(py - pxPerCar * 0.75).toFixed(2)})`,
        );
      }

      if (node.trail && frame.current % 3 === 0) {
        let pts = trails.current.get(n);
        if (!pts) {
          pts = [];
          trails.current.set(n, pts);
        }
        pts.push(px, py);
        if (pts.length > 56) pts.splice(0, pts.length - 56);
        let d = '';
        for (let i = 0; i < pts.length; i += 2) d += `${pts[i]!.toFixed(1)},${pts[i + 1]!.toFixed(1)} `;
        node.trail.setAttribute('points', d);
      }
    }
  });

  return (
    <>
      {showTrails && (
        <g opacity="0.55">
          {drivers.map((d) => (
            <polyline
              key={`trail-${d.number}`}
              ref={(el) => registerTrail(nodes, d.number, el)}
              fill="none"
              stroke={d.colour}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      )}

      <g>
        {drivers.map((d) => {
          const livery = buildLivery(d.colour);
          const second = isSecondCar(d.number, teamNumbers.get(d.team) ?? []);
          return (
            <g
              key={d.number}
              ref={(el) => registerGroup(nodes, d.number, el)}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`${d.fullName}, ${d.team}`}
              onClick={() => selectDriver(d.number)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectDriver(d.number); }}
              style={{
                '--primary': livery.primary,
                '--highlight': livery.highlight,
                '--shadow': livery.shadow,
                '--accent': second ? '#FFFFFF' : livery.accent,
              } as React.CSSProperties}
            >
              {selected === d.number && (
                <circle r="30" fill={d.colour} opacity="0.18" className="animate-pulse-slow" />
              )}
              {/*
                A <use> of a <symbol> with a viewBox defaults to 100% of the nearest
                viewport, which sizes every car to the whole map. Stating the symbol's
                own box maps it 1:1, so the group transform controls the size.
              */}
              <use
                ref={(el) => registerCar(nodes, d.number, el)}
                href="#f1-car"
                x={-CAR_LENGTH / 2}
                y={-CAR_HEIGHT / 2}
                width={CAR_LENGTH}
                height={CAR_HEIGHT}
              />
            </g>
          );
        })}
      </g>

      {showLabels && (
        <g className="pointer-events-none">
          {drivers.map((d) => (
            <g key={`lab-${d.number}`} ref={(el) => registerLabel(nodes, d.number, el)}>
              <text
                textAnchor="middle"
                className="font-mono text-[9px] font-bold"
                fill="#FFFFFF"
                stroke="rgba(0,0,0,0.9)"
                strokeWidth="2.6"
                paintOrder="stroke"
              >
                {d.acronym}
              </text>
            </g>
          ))}
        </g>
      )}
    </>
  );
}

type NodeMap = React.MutableRefObject<Map<number, {
  group: SVGGElement;
  car: SVGUseElement;
  label: SVGGElement | null;
  trail: SVGPolylineElement | null;
}>>;

const ensure = (map: NodeMap, n: number) => {
  let e = map.current.get(n);
  if (!e) {
    e = { group: null as unknown as SVGGElement, car: null as unknown as SVGUseElement, label: null, trail: null };
    map.current.set(n, e);
  }
  return e;
};

const registerGroup = (m: NodeMap, n: number, el: SVGGElement | null) => { if (el) ensure(m, n).group = el; };
const registerCar = (m: NodeMap, n: number, el: SVGUseElement | null) => { if (el) ensure(m, n).car = el; };
const registerLabel = (m: NodeMap, n: number, el: SVGGElement | null) => { if (el) ensure(m, n).label = el; };
const registerTrail = (m: NodeMap, n: number, el: SVGPolylineElement | null) => { if (el) ensure(m, n).trail = el; };
