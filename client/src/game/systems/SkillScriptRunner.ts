import Phaser from 'phaser';
import type { AssetAnimClip } from '../../types';
import type { AnimationController } from './AnimationController';
import type { ProjectileManager } from './ProjectileManager';

export interface SkillScriptContext {
  onGround: boolean;
  vx: number;
  vy: number;
  setVelocity(x: number, y: number): void;
  jump(force?: number): void;
  impulse(axis: 'x' | 'y', force: number): void;
  dash(distance?: number, cooldown?: number): void;
  shoot(opts?: { assetId?: string; speed?: number; life?: number }): void;
  playAnim(clip: AssetAnimClip): void;
  cooldownReady(): boolean;
  setCooldown(ms: number): void;
}

interface RunnerDeps {
  body: Phaser.Physics.Arcade.Body;
  sprite: Phaser.Physics.Arcade.Sprite;
  onGroundFn: () => boolean;
  projectiles?: ProjectileManager;
  animCtrl?: AnimationController;
  skillId: string;
  getCooldown: (id: string) => number;
  setCooldownFor: (id: string, ms: number) => void;
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

export function validateSkillScript(script: string): string | null {
  if (!script.trim()) return 'El script no puede estar vacío';
  if (script.length > 2048) return 'Script demasiado largo (máx 2048 caracteres)';
  for (const pat of BLOCKED_PATTERNS) {
    if (pat.test(script)) return 'Script contiene código no permitido';
  }
  return null;
}

export function runSkillScript(script: string, deps: RunnerDeps): void {
  const err = validateSkillScript(script);
  if (err) return;

  const ctx: SkillScriptContext = {
    onGround: deps.onGroundFn(),
    get vx() {
      return deps.body.velocity.x;
    },
    get vy() {
      return deps.body.velocity.y;
    },
    setVelocity(x: number, y: number) {
      deps.body.setVelocity(x, y);
    },
    jump(force = 420) {
      if (deps.onGroundFn()) deps.body.setVelocityY(-force);
    },
    impulse(axis: 'x' | 'y', force: number) {
      if (axis === 'x') deps.body.setVelocityX(force);
      else deps.body.setVelocityY(-force);
    },
    dash(distance = 120, cooldown = 500) {
      if ((deps.getCooldown(deps.skillId) ?? 0) > 0) return;
      const dir = deps.body.velocity.x >= 0 ? 1 : -1;
      deps.body.setVelocityX(dir * distance * 4);
      deps.setCooldownFor(deps.skillId, cooldown);
    },
    shoot(opts = {}) {
      if ((deps.getCooldown(deps.skillId) ?? 0) > 0) return;
      const dir = deps.sprite.flipX ? -1 : 1;
      deps.projectiles?.fire(
        deps.sprite.x + dir * 20,
        deps.sprite.y,
        dir,
        opts.assetId,
        opts.speed ?? 420,
        opts.life ?? 2000
      );
      deps.setCooldownFor(deps.skillId, 300);
    },
    playAnim(clip: AssetAnimClip) {
      deps.animCtrl?.triggerOneShot(clip);
    },
    cooldownReady() {
      return (deps.getCooldown(deps.skillId) ?? 0) <= 0;
    },
    setCooldown(ms: number) {
      deps.setCooldownFor(deps.skillId, ms);
    },
  };

  try {
    const fn = new Function('ctx', script);
    fn(ctx);
  } catch {
    /* invalid user script — ignore at runtime */
  }
}
