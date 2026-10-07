import type { CarPosition } from '../types/index.js';

interface Snapshot { tMs: number; byDriver: Map<number, CarPosition>; receivedAt: number }

export interface RenderedCar { n: number; x: number; y: number; h: number; q: number }

const RENDER_DELAY_MS = 120;
const MAX_BUFFER = 24;

export class AnimationEngine {
  private buffer: Snapshot[] = [];
  private playbackOffset: number | null = null;
  private readonly out = new Map<number, RenderedCar>();

  push(positions: CarPosition[], tMs: number): void {
    const byDriver = new Map<number, CarPosition>();
    for (const p of positions) byDriver.set(p.n, p);
    this.buffer.push({ tMs, byDriver, receivedAt: performance.now() });
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();

    const localGuess = this.playbackOffset === null ? null : performance.now() - this.playbackOffset;
    if (localGuess === null || Math.abs(localGuess - tMs) > 500) {
      this.playbackOffset = performance.now() - tMs;
    }
  }

  reset(): void {
    this.buffer = [];
    this.playbackOffset = null;
    this.out.clear();
  }

  sample(): Map<number, RenderedCar> {
    if (this.playbackOffset === null || this.buffer.length === 0) return this.out;

    const renderTime = performance.now() - this.playbackOffset - RENDER_DELAY_MS;

    let a: Snapshot | undefined;
    let b: Snapshot | undefined;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i]!.tMs <= renderTime) { a = this.buffer[i]; b = this.buffer[i + 1]; break; }
    }
    if (!a) a = this.buffer[0];
    if (!a) return this.out;

    if (!b) {
      for (const [n, p] of a.byDriver) this.write(n, p.x, p.y, p.h, p.q);
      return this.out;
    }

    const span = b.tMs - a.tMs;
    const f = span > 0 ? Math.min(1, Math.max(0, (renderTime - a.tMs) / span)) : 0;

    for (const [n, pa] of a.byDriver) {
      const pb = b.byDriver.get(n);
      if (!pb) { this.write(n, pa.x, pa.y, pa.h, pa.q); continue; }
      this.write(
        n,
        pa.x + (pb.x - pa.x) * f,
        pa.y + (pb.y - pa.y) * f,
        lerpAngle(pa.h, pb.h, f),
        pa.q + (pb.q - pa.q) * f,
      );
    }
    return this.out;
  }

  private write(n: number, x: number, y: number, h: number, q: number): void {
    const existing = this.out.get(n);
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.h = h;
      existing.q = q;
    } else {
      this.out.set(n, { n, x, y, h, q });
    }
  }
}

function lerpAngle(a: number, b: number, f: number): number {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * f;
}
