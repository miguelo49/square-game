import { v4 as uuidv4 } from 'uuid';
import type { LevelSchema } from '../types';
import {
  MAX_PLATFORMS,
  MAX_ENEMIES,
  MAX_LEVEL_WIDTH,
  MAX_LEVEL_HEIGHT,
} from '../data/retroLimits';
import {
  entityCenterYOnSurface,
  portalCenterOnPlatform,
  PORTAL_H,
} from '../game/utils/placement';

/** Dark void background for default / procedural levels (Tron-style). */
export const DEFAULT_LEVEL_BACKGROUND = '#0a1020';

export function generateDemoLevel(): LevelSchema {
  return {
    version: 1,
    name: 'Nivel Demo',
    width: 3200,
    height: 960,
    spawn: { x: 128, y: entityCenterYOnSurface(896) },
    backgroundColor: DEFAULT_LEVEL_BACKGROUND,
    platforms: [
      { id: 'p1', x: 0, y: 896, w: 3200, h: 64, solid: true },
      { id: 'p2', x: 256, y: 768, w: 256, h: 32, solid: true },
      { id: 'p3', x: 576, y: 640, w: 192, h: 32, solid: true },
      { id: 'p4', x: 832, y: 512, w: 256, h: 32, solid: true },
      { id: 'p5', x: 1152, y: 640, w: 192, h: 32, solid: true },
      { id: 'p6', x: 1408, y: 768, w: 384, h: 32, solid: true },
      { id: 'p7', x: 1856, y: 576, w: 256, h: 32, solid: true },
      { id: 'p8', x: 2176, y: 704, w: 192, h: 32, solid: true },
      { id: 'p9', x: 2432, y: 832, w: 512, h: 32, solid: true },
    ],
    enemies: [
      { id: 'e1', x: 672, y: entityCenterYOnSurface(640), behavior: 'patrol', patrolRange: 128 },
      { id: 'e2', x: 1600, y: entityCenterYOnSurface(768), behavior: 'patrol', patrolRange: 192 },
      { id: 'e3', x: 2688, y: entityCenterYOnSurface(832), behavior: 'chase', patrolRange: 256 },
    ],
    portal: { x: 2880, y: entityCenterYOnSurface(832, PORTAL_H), w: 32, h: PORTAL_H },
    skills: [
      'skill_jump',
      'skill_double_jump',
      'skill_move_left',
      'skill_move_right',
      'skill_move_left_a',
      'skill_move_right_d',
    ],
  };
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateProceduralLevel(seed?: number): LevelSchema {
  const s = seed ?? Math.floor(Math.random() * 999999);
  const rand = seededRandom(s);
  const width = 1600 + Math.floor(rand() * 1600);
  const height = 960;

  const platforms: LevelSchema['platforms'] = [
    { id: uuidv4(), x: 0, y: height - 64, w: width, h: 64, solid: true },
  ];

  // Keep floating platforms in the lower ~55% of the level (avoid top-corner clutter)
  const minPlatformY = Math.floor(height * 0.45);
  const maxPlatformY = height - 128;

  let x = 128;
  let y = height - 192;
  while (x < width - 200 && platforms.length < MAX_PLATFORMS - 1) {
    const pw = 128 + Math.floor(rand() * 192);
    const gap = 64 + Math.floor(rand() * 128);
    const dy = (Math.floor(rand() * 3) - 1) * 64;
    y = Math.max(minPlatformY, Math.min(maxPlatformY, y + dy));

    platforms.push({
      id: uuidv4(),
      x,
      y,
      w: pw,
      h: 32,
      solid: true,
      presetId: 'static',
    });

    x += pw + gap;
  }

  const enemies: LevelSchema['enemies'] = [];
  const enemyCount = Math.min(MAX_ENEMIES, 2 + Math.floor(rand() * 5));
  for (let i = 0; i < enemyCount; i++) {
    const plat = platforms[1 + Math.floor(rand() * (platforms.length - 1))];
    if (!plat) break;
    enemies.push({
      id: uuidv4(),
      x: plat.x + plat.w / 2,
      y: entityCenterYOnSurface(plat.y),
      behavior: rand() > 0.6 ? 'chase' : 'patrol',
      patrolRange: 64 + Math.floor(rand() * 128),
    });
  }

  const lastPlat = platforms[platforms.length - 1]!;
  const portalPos = portalCenterOnPlatform(lastPlat, lastPlat.x + lastPlat.w - 48);
  const ground = platforms[0]!;

  return {
    version: 1,
    name: `Generado #${s}`,
    width: Math.min(width, MAX_LEVEL_WIDTH),
    height: Math.min(height, MAX_LEVEL_HEIGHT),
    spawn: { x: 128, y: entityCenterYOnSurface(ground.y) },
    portal: { x: portalPos.x, y: portalPos.y, w: 32, h: PORTAL_H },
    backgroundColor: DEFAULT_LEVEL_BACKGROUND,
    platforms,
    enemies,
    skills: [
      'skill_jump',
      'skill_double_jump',
      'skill_move_left',
      'skill_move_right',
      'skill_move_left_a',
      'skill_move_right_d',
    ],
  };
}

export function validateLevel(level: LevelSchema): string | null {
  if (level.width > MAX_LEVEL_WIDTH) return `Ancho máximo ${MAX_LEVEL_WIDTH}px`;
  if (level.height > MAX_LEVEL_HEIGHT) return `Alto máximo ${MAX_LEVEL_HEIGHT}px`;
  if (level.platforms.length > MAX_PLATFORMS) return `Máximo ${MAX_PLATFORMS} plataformas`;
  if (level.enemies.length > MAX_ENEMIES) return `Máximo ${MAX_ENEMIES} enemigos`;
  for (const p of level.platforms) {
    if ((p.rules?.length ?? 0) > 5) {
      return `Plataforma ${p.id}: máximo 5 reglas`;
    }
  }
  const wc = level.winCondition;
  if (wc && wc.type !== 'portal' && (wc.target ?? 0) < 1) {
    return 'Objetivo de victoria inválido';
  }
  return null;
}
