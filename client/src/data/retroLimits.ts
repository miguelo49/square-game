export const TILE_SIZE = 32;
export const GRID_SNAP = 8;

export const MAX_LEVEL_WIDTH = 6400;
export const MAX_LEVEL_HEIGHT = 1920;
export const MAX_PLATFORMS = 200;
export const MAX_ENEMIES = 50;
export const MAX_ASSETS_PER_USER = 64;
export const MAX_COLORS_PER_SPRITE = 16;

export const ALLOWED_SIZES = {
  player: [16, 32] as const,
  platform: [8, 16, 32] as const,
  enemy: [16, 32] as const,
};

export const DEFAULT_SIZES = {
  player: 32,
  platform: 16,
  enemy: 32,
} as const;

export const KEY_OPTIONS = [
  { label: 'Espacio', value: 'SPACE' },
  { label: 'Flecha Arriba', value: 'UP' },
  { label: 'Flecha Abajo', value: 'DOWN' },
  { label: 'Flecha Izq', value: 'LEFT' },
  { label: 'Flecha Der', value: 'RIGHT' },
  { label: 'A', value: 'A' },
  { label: 'D', value: 'D' },
  { label: 'W', value: 'W' },
  { label: 'S', value: 'S' },
  { label: 'Shift', value: 'SHIFT' },
  { label: 'Z', value: 'Z' },
  { label: 'X', value: 'X' },
];

export const ACTION_OPTIONS = [
  { label: 'Saltar', value: 'jump' },
  { label: 'Mover', value: 'move' },
  { label: 'Dash', value: 'dash' },
  { label: 'Gravedad', value: 'gravity' },
];
