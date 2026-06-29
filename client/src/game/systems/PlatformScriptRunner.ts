import Phaser from 'phaser';
import type { PlatformDef } from '../../types';
import type { PlatformEntity } from '../entities/PlatformEntity';

export interface PlatformScriptContext {
  delta: number;
  x: number;
  y: number;
  w: number;
  h: number;
  touchingPlayer: boolean;
  moveBy(dx: number, dy: number): void;
  fade(duration?: number, destroyAfter?: boolean): void;
  setSolid(solid: boolean): void;
  destroy(): void;
  spawnClone(offsets?: { x?: number; y?: number }): void;
}

interface RunnerDeps {
  entity: PlatformEntity;
  player: Phaser.Physics.Arcade.Sprite;
  delta: number;
  spawnClone: (offsets?: { x?: number; y?: number }) => void;
  fade: (duration?: number, destroyAfter?: boolean) => void;
  setSolid: (solid: boolean) => void;
  destroy: () => void;
}

const BLOCKED_PATTERNS = [
  /\beval\b/i,
  /\bimport\b/i,
  /\bfetch\b/i,
  /\bwindow\b/i,
  /\bdocument\b/i,
  /\bFunction\b/,
  /\b__proto__\b/,
  /\bconstructor\b/,
];

export function validatePlatformScript(script: string): string | null {
  if (!script.trim()) return 'El script no puede estar vacío';
  if (script.length > 2048) return 'Script demasiado largo (máx 2048 caracteres)';
  for (const pat of BLOCKED_PATTERNS) {
    if (pat.test(script)) return 'Script contiene código no permitido';
  }
  return null;
}

export function runPlatformScript(script: string, deps: RunnerDeps): void {
  const err = validatePlatformScript(script);
  if (err) return;

  const ctx: PlatformScriptContext = {
    delta: deps.delta,
    get x() {
      return deps.entity.baseX;
    },
    get y() {
      return deps.entity.baseY;
    },
    get w() {
      return deps.entity.def.w;
    },
    get h() {
      return deps.entity.def.h;
    },
    get touchingPlayer() {
      return deps.entity.touchingPlayer;
    },
    moveBy(dx: number, dy: number) {
      deps.entity.moveBy(dx, dy);
    },
    fade(duration?: number, destroyAfter?: boolean) {
      deps.fade(duration, destroyAfter);
    },
    setSolid(solid: boolean) {
      deps.setSolid(solid);
    },
    destroy() {
      deps.destroy();
    },
    spawnClone(offsets?: { x?: number; y?: number }) {
      deps.spawnClone(offsets);
    },
  };

  try {
    const fn = new Function('ctx', script);
    fn(ctx);
  } catch {
    /* invalid user script */
  }
}

export function stripRuntimePlatforms(level: { platforms: PlatformDef[] }): PlatformDef[] {
  return level.platforms.filter((p) => !p.runtimeOnly);
}
