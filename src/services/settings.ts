import type { ThemePreset, GameSettings } from '../components/SettingsModal';

const STORAGE_KEY = 'gameSettings';

const DEFAULTS: GameSettings = {
  theme: 'classic',
  muteMusic: false,
  muteSfx: false,
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed } as GameSettings;
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(settings: GameSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  // expose on document for any non-React audio hooks
  document.documentElement.dataset.muteMusic = String(settings.muteMusic);
  document.documentElement.dataset.muteSfx = String(settings.muteSfx);
}

export function themeClass(theme: ThemePreset): string {
  return `theme-${theme}`;
}
