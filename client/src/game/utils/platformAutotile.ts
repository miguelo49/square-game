import type { PlatformDef, PlatformTileVariant } from '../../types';
import { DEFAULT_SIZES } from '../../data/retroLimits';

export const PLATFORM_TILE_SIZE = DEFAULT_SIZES.platform;

export interface PlatformTileCell {
  localX: number;
  localY: number;
  worldX: number;
  worldY: number;
  variant: PlatformTileVariant;
}

export function platformVisualGroup(def: PlatformDef): string {
  return def.assetId ?? 'default';
}

export function buildOccupancyGrid(
  platforms: PlatformDef[],
  tileSize = PLATFORM_TILE_SIZE
): Map<string, Set<string>> {
  const grid = new Map<string, Set<string>>();
  for (const p of platforms) {
    const group = platformVisualGroup(p);
    if (!grid.has(group)) grid.set(group, new Set());
    const set = grid.get(group)!;
    const cols = Math.max(1, Math.ceil(p.w / tileSize));
    const rows = Math.max(1, Math.ceil(p.h / tileSize));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const gx = Math.floor((p.x + c * tileSize) / tileSize);
        const gy = Math.floor((p.y + r * tileSize) / tileSize);
        set.add(`${gx},${gy}`);
      }
    }
  }
  return grid;
}

function hasCell(set: Set<string>, gx: number, gy: number): boolean {
  return set.has(`${gx},${gy}`);
}

export function resolveTileVariant(
  group: string,
  gx: number,
  gy: number,
  isTopRow: boolean,
  isBottomRow: boolean,
  occupancy: Map<string, Set<string>>
): PlatformTileVariant {
  const set = occupancy.get(group) ?? new Set();
  const left = hasCell(set, gx - 1, gy);
  const right = hasCell(set, gx + 1, gy);
  const top = hasCell(set, gx, gy - 1);
  const bottom = hasCell(set, gx, gy + 1);

  if (isTopRow && !top) {
    if (!left && !right) return 'topSingle';
    if (!left && right) return 'topLeft';
    if (left && !right) return 'topRight';
    return 'topMid';
  }

  if (isBottomRow && !bottom) {
    if (!left && !right) return 'bottomSingle';
    if (!left && right) return 'bottomLeft';
    if (left && !right) return 'bottomRight';
    return 'bottomMid';
  }

  if (!left && !right) return 'fillSingle';
  if (!left) return 'fillLeft';
  if (!right) return 'fillRight';
  return 'fillMid';
}

export function decomposePlatformTiles(
  def: PlatformDef,
  occupancy: Map<string, Set<string>>,
  tileSize = PLATFORM_TILE_SIZE
): PlatformTileCell[] {
  const group = platformVisualGroup(def);
  const cols = Math.max(1, Math.ceil(def.w / tileSize));
  const rows = Math.max(1, Math.ceil(def.h / tileSize));
  const cells: PlatformTileCell[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const worldX = def.x + c * tileSize;
      const worldY = def.y + r * tileSize;
      const gx = Math.floor(worldX / tileSize);
      const gy = Math.floor(worldY / tileSize);
      const variant = resolveTileVariant(
        group,
        gx,
        gy,
        r === 0,
        r === rows - 1,
        occupancy
      );
      cells.push({
        localX: c * tileSize + tileSize / 2,
        localY: r * tileSize + tileSize / 2,
        worldX: worldX + tileSize / 2,
        worldY: worldY + tileSize / 2,
        variant,
      });
    }
  }

  return cells;
}

export function autotileTextureKey(group: string, variant: PlatformTileVariant): string {
  return `platform-tile-${group}-${variant}`;
}
