// SNES-inspired master palette (64 colors)
export const SNES_PALETTE: string[] = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
  '#880000', '#008800', '#000088', '#888800', '#880088', '#008888', '#cccccc', '#888888',
  '#ff8888', '#88ff88', '#8888ff', '#ffff88', '#ff88ff', '#88ffff', '#ff4444', '#44ff44',
  '#4444ff', '#ffaa00', '#aa00ff', '#00aaff', '#663300', '#336600', '#003366', '#666600',
  '#660066', '#006666', '#993333', '#339933', '#333399', '#999933', '#993399', '#339999',
  '#552288', '#228855', '#885522', '#225588', '#582858', '#285828', '#582828', '#282858',
  '#c0c0c0', '#808080', '#404040', '#a0a0ff', '#ffa0a0', '#a0ffa0', '#ffd700', '#da70d6',
  '#20b2aa', '#ff6347', '#4682b4', '#9acd32', '#cd853f', '#708090', '#eee8aa', '#f0e68c',
];

/** Default sprite subpalette: slot 0 unused (transparent), slot 1 = black SNES */
export const DEFAULT_PALETTE_SLOTS: number[] = [
  0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
];

export function paletteColor(index: number): string {
  return SNES_PALETTE[index % SNES_PALETTE.length] ?? '#ff00ff';
}

export function countUsedColors(pixels: number[], paletteSlots: number[]): number {
  const used = new Set<number>();
  for (const p of pixels) {
    if (p !== 0) used.add(paletteSlots[p] ?? p);
  }
  return used.size;
}

export function validateAssetPixels(
  pixels: number[],
  paletteSlots: number[],
  width: number,
  height: number
): string | null {
  if (pixels.length !== width * height) {
    return `Pixels debe ser ${width * height} (${width}x${height})`;
  }
  const colorCount = countUsedColors(pixels, paletteSlots);
  if (colorCount > 15) {
    return `Máximo 15 colores (+ transparente). Usados: ${colorCount}`;
  }
  for (const p of pixels) {
    if (p < 0 || p > 15) return 'Índice de pixel inválido (0-15)';
  }
  return null;
}

const KNOWN_SIZES = [8, 16, 32] as const;

function inferSourceSize(pixelCount: number): number | null {
  for (const s of KNOWN_SIZES) {
    if (s * s === pixelCount) return s;
  }
  return null;
}

/** Center smaller pixel data into target size with transparent borders */
export function normalizeAssetPixels(
  pixels: number[],
  toW: number,
  toH: number
): number[] {
  const targetLen = toW * toH;
  if (pixels.length === targetLen) return pixels;

  const fromSize = inferSourceSize(pixels.length);
  if (fromSize !== null && toW === toH && fromSize <= toW) {
    const result = new Array(targetLen).fill(0);
    const offsetX = Math.floor((toW - fromSize) / 2);
    const offsetY = Math.floor((toH - fromSize) / 2);
    for (let y = 0; y < fromSize; y++) {
      for (let x = 0; x < fromSize; x++) {
        result[(y + offsetY) * toW + (x + offsetX)] = pixels[y * fromSize + x] ?? 0;
      }
    }
    return result;
  }

  if (pixels.length < targetLen) {
    const result = new Array(targetLen).fill(0);
    for (let i = 0; i < pixels.length; i++) result[i] = pixels[i];
    return result;
  }

  return pixels.slice(0, targetLen);
}
