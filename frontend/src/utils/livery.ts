function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;

export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return amount >= 0
    ? toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
    : toHex(r * (1 + amount), g * (1 + amount), b * (1 + amount));
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export interface Livery {
  primary: string;
  highlight: string;
  shadow: string;
  accent: string;
  ink: string;
}

export function buildLivery(teamColour: string): Livery {
  const safe = /^#[0-9a-f]{6}$/i.test(teamColour) ? teamColour : '#9AA0A6';
  return {
    primary: safe,
    highlight: shade(safe, 0.3),
    shadow: shade(safe, -0.5),
    accent: shade(safe, 0.5),
    ink: luminance(safe) > 0.55 ? '#0A0A11' : '#FFFFFF',
  };
}

export function isSecondCar(driverNumber: number, teamNumbers: number[]): boolean {
  return [...teamNumbers].sort((a, b) => a - b)[1] === driverNumber;
}
