import type { TrackBounds } from '../types/index.js';

export interface Viewport {
  width: number;
  height: number;
  padding: number;
  rotation: number;
  flipY: boolean;
}

export class CoordinateMapper {
  private bounds: TrackBounds | null = null;
  private viewport: Viewport = { width: 0, height: 0, padding: 56, rotation: 0, flipY: true };
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private cos = 1;
  private sin = 0;

  setBounds(bounds: TrackBounds): void {
    this.bounds = bounds;
    this.recompute();
  }

  setViewport(viewport: Partial<Viewport>): void {
    this.viewport = { ...this.viewport, ...viewport };
    this.recompute();
  }

  get ready(): boolean { return this.bounds !== null && this.viewport.width > 0; }
  get pxPerMetre(): number { return this.scale; }

  private recompute(): void {
    const b = this.bounds;
    const v = this.viewport;
    if (!b || v.width <= 0 || v.height <= 0) return;

    const rad = (v.rotation * Math.PI) / 180;
    this.cos = Math.cos(rad);
    this.sin = Math.sin(rad);

    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const corners: [number, number][] = [
      [b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY],
    ];

    let rminX = Infinity, rmaxX = -Infinity, rminY = Infinity, rmaxY = -Infinity;
    for (const [x, y] of corners) {
      const dx = x - cx;
      const dy = y - cy;
      const rx = dx * this.cos - dy * this.sin;
      const ry = dx * this.sin + dy * this.cos;
      rminX = Math.min(rminX, rx); rmaxX = Math.max(rmaxX, rx);
      rminY = Math.min(rminY, ry); rmaxY = Math.max(rmaxY, ry);
    }

    const spanX = rmaxX - rminX || 1;
    const spanY = rmaxY - rminY || 1;
    const usableW = v.width - v.padding * 2;
    const usableH = v.height - v.padding * 2;
    this.scale = Math.min(usableW / spanX, usableH / spanY);

    this.offsetX = v.width / 2 - ((rminX + rmaxX) / 2) * this.scale;
    this.offsetY = v.height / 2 - ((rminY + rmaxY) / 2) * this.scale * (v.flipY ? -1 : 1);
  }

  project(x: number, y: number): [number, number] {
    const b = this.bounds;
    if (!b) return [0, 0];
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const dx = x - cx;
    const dy = y - cy;
    const rx = dx * this.cos - dy * this.sin;
    const ry = dx * this.sin + dy * this.cos;
    return [
      rx * this.scale + this.offsetX,
      ry * this.scale * (this.viewport.flipY ? -1 : 1) + this.offsetY,
    ];
  }

  projectAngle(h: number): number {
    const rotated = h + (this.viewport.rotation * Math.PI) / 180;
    const screen = this.viewport.flipY ? -rotated : rotated;
    return (screen * 180) / Math.PI;
  }

  projectPath(points: [number, number][]): string {
    if (points.length === 0) return '';
    let d = '';
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      const [sx, sy] = this.project(p[0], p[1]);
      d += `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)} ${sy.toFixed(1)}`;
    }
    return `${d}Z`;
  }
}
