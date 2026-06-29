import type { PlatformDef } from '../../types';
import { GRID_SNAP } from '../../data/retroLimits';

export const ENTITY_H = 32;
export const PORTAL_H = 48;

export function entityCenterYOnSurface(surfaceY: number, height = ENTITY_H): number {
  return surfaceY - height / 2;
}

export function findPlatformAt(x: number, y: number, platforms: PlatformDef[]): PlatformDef | null {
  let best: PlatformDef | null = null;
  let bestDist = Infinity;

  for (const p of platforms) {
    if (x < p.x || x > p.x + p.w) continue;
    const surfaceY = p.y;
    if (surfaceY >= y - 8) continue;
    const dist = y - surfaceY;
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }

  return best;
}

export function snapToPlatformSurface(
  x: number,
  y: number,
  platforms: PlatformDef[],
  entityHeight = ENTITY_H
): { x: number; y: number } {
  const snappedX = Math.round(x / GRID_SNAP) * GRID_SNAP;
  const platform = findPlatformAt(snappedX, y + entityHeight / 2, platforms);

  if (platform) {
    return {
      x: snappedX,
      y: entityCenterYOnSurface(platform.y, entityHeight),
    };
  }

  return {
    x: snappedX,
    y: Math.round(y / GRID_SNAP) * GRID_SNAP,
  };
}

export function enemyCenterOnPlatform(
  platform: PlatformDef,
  centerX: number
): { x: number; y: number } {
  return {
    x: centerX,
    y: entityCenterYOnSurface(platform.y, ENTITY_H),
  };
}

export function portalCenterOnPlatform(
  platform: PlatformDef,
  centerX: number
): { x: number; y: number } {
  return {
    x: centerX,
    y: entityCenterYOnSurface(platform.y, PORTAL_H),
  };
}

export function migrateLevel<T extends { portal?: { x: number; y: number; w: number; h: number }; width: number; height: number; platforms: PlatformDef[] }>(
  level: T
): T & { portal: { x: number; y: number; w: number; h: number } } {
  if (level.portal) {
    return level as T & { portal: { x: number; y: number; w: number; h: number } };
  }

  const ground = level.platforms[0];
  const portalX = level.width - 128;
  const surfaceY = ground?.y ?? level.height - 64;

  return {
    ...level,
    portal: {
      x: portalX,
      y: entityCenterYOnSurface(surfaceY, PORTAL_H),
      w: 32,
      h: PORTAL_H,
    },
  };
}
