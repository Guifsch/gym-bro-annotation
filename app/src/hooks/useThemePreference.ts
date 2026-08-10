import { create } from 'zustand';

import { readJson, writeJson } from '@/offline/storage';

export type ThemeName = 'light' | 'dark';

const STORAGE_KEY = 'theme-preference';

interface ThemePreferenceState {
  /** `null` means "follow system" — the user hasn't overridden it yet. */
  override: ThemeName | null;
  load: () => Promise<void>;
  setOverride: (theme: ThemeName) => void;
}

export const useThemePreferenceStore = create<ThemePreferenceState>((set) => ({
  override: null,

  load: async () => {
    const stored = await readJson<ThemeName | null>(STORAGE_KEY, null);
    set({ override: stored });
  },

  setOverride: (theme) => {
    set({ override: theme });
    void writeJson(STORAGE_KEY, theme);
  },
}));
