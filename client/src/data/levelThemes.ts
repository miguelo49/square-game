import type { LevelTheme } from '../types';

export const LEVEL_THEMES: Record<string, LevelTheme & { label: string }> = {
  void: {
    id: 'void',
    label: 'Vacío Tron',
    backgroundColor: '#0a1020',
    gridColor: '#ffffff',
    parallaxLayers: ['#0a1020', '#121830'],
  },
  grass: {
    id: 'grass',
    label: 'Pradera',
    backgroundColor: '#1a4020',
    gridColor: '#88cc88',
    parallaxLayers: ['#2a6030', '#1a4020', '#0a2010'],
  },
  cave: {
    id: 'cave',
    label: 'Cueva',
    backgroundColor: '#1a1028',
    gridColor: '#8866aa',
    parallaxLayers: ['#2a1838', '#1a1028'],
  },
};

export function applyTheme(themeId: string): Partial<{
  backgroundColor: string;
  themeId: string;
}> {
  const t = LEVEL_THEMES[themeId];
  if (!t) return {};
  return { backgroundColor: t.backgroundColor, themeId: t.id };
}

export type LevelThemeId = keyof typeof LEVEL_THEMES;
