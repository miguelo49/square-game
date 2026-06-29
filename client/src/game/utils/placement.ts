import type { PlatformDef } from '../../types';
import { GRID_SNAP } from '../../data/retroLimits';
import { expandPlatformPreset } from '../../data/platformPresets';

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

export function migratePlatformDef(p: PlatformDef): PlatformDef {
  const expanded = expandPlatformPreset(p);
  const { runtimeOnly: _, ...rest } = expanded;
  return rest;
}

export function migrateLevel<T extends { portal?: { x: number; y: number; w: number; h: number }; width: number; height: number; platforms: PlatformDef[]; coins?: unknown[]; checkpoints?: unknown[] }>(
  level: T
): T & { portal: { x: number; y: number; w: number; h: number } } {
  const migratedPlatforms = level.platforms
    .filter((p) => !p.runtimeOnly)
    .map(migratePlatformDef);
  const base = {
    ...level,
    platforms: migratedPlatforms,
    coins: level.coins ?? [],
    checkpoints: level.checkpoints ?? [],
    decorations: (level as { decorations?: unknown[] }).decorations ?? [],
    hazards: (level as { hazards?: unknown[] }).hazards ?? [],
    winCondition: (level as { winCondition?: unknown }).winCondition ?? { type: 'portal' },
  };

  if (base.portal) {
    return base as T & { portal: { x: number; y: number; w: number; h: number } };
  }

  const ground = level.platforms[0];
  const portalX = level.width - 128;
  const surfaceY = ground?.y ?? level.height - 64;

  return {
    ...base,
    portal: {
      x: portalX,
      y: entityCenterYOnSurface(surfaceY, PORTAL_H),
      w: 32,
      h: PORTAL_H,
    },
  } as T & { portal: { x: number; y: number; w: number; h: number } };
}
