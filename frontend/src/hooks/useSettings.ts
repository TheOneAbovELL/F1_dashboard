import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Settings {
  showLabels: boolean;
  showTrails: boolean;
  showSectors: boolean;
  showCorners: boolean;
  gapMode: 'leader' | 'interval';
  units: 'metric' | 'imperial';
  rotation: number;
  reduceMotion: boolean;
}

interface SettingsStore extends Settings {
  set<K extends keyof Settings>(key: K, value: Settings[K]): void;
  toggle(key: keyof Settings): void;
  reset(): void;
}

const defaults: Settings = {
  showLabels: true,
  showTrails: true,
  showSectors: true,
  showCorners: false,
  gapMode: 'leader',
  units: 'metric',
  rotation: 0,
  reduceMotion: false,
};

export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...defaults,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      toggle: (key) => {
        const current = get()[key];
        if (typeof current === 'boolean') set({ [key]: !current } as Partial<Settings>);
      },
      reset: () => set(defaults),
    }),
    { name: 'f1-visualizer-settings', version: 1 },
  ),
);
