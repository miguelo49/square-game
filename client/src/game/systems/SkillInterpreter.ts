import Phaser from 'phaser';
import type { SkillSchema } from '../../types';
import { toPhaserKey } from '../utils/phaserKeys';
import type { ProjectileManager } from './ProjectileManager';
import type { AnimationController } from './AnimationController';

interface CooldownState {
  [skillId: string]: number;
}

export class SkillInterpreter {
  private skills: SkillSchema[] = [];
  private keys: Map<string, Phaser.Input.Keyboard.Key> = new Map();
  private cooldowns: CooldownState = {};
  private scene: Phaser.Scene;
  private body: Phaser.Physics.Arcade.Body;
  private sprite: Phaser.Physics.Arcade.Sprite;
  private onGroundFn: () => boolean;
  private projectiles?: ProjectileManager;
  private animCtrl?: AnimationController;
  private baseScale = 1;
  private scaleTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.Physics.Arcade.Sprite,
    onGroundFn: () => boolean
  ) {
    this.scene = scene;
    this.sprite = sprite;
    this.body = sprite.body as Phaser.Physics.Arcade.Body;
    this.onGroundFn = onGroundFn;
    this.baseScale = sprite.scaleX;
  }

  setProjectileManager(pm: ProjectileManager): void {
    this.projectiles = pm;
  }

  setAnimationController(ctrl: AnimationController | undefined): void {
    this.animCtrl = ctrl;
  }

  loadSkills(skills: SkillSchema[]): void {
    this.skills = skills;
    this.keys.clear();

    if (!this.scene.input.keyboard) return;

    for (const skill of skills) {
      const phaserKey = toPhaserKey(skill.trigger.key);
      const key = this.scene.input.keyboard.addKey(phaserKey);
      this.keys.set(skill.id, key);
    }
  }

  update(_time: number, delta: number): void {
    for (const skillId of Object.keys(this.cooldowns)) {
      this.cooldowns[skillId] = Math.max(0, this.cooldowns[skillId] - delta);
    }

    for (const skill of this.skills) {
      const key = this.keys.get(skill.id);
      if (!key) continue;

      const triggered =
        skill.trigger.type === 'hold'
          ? key.isDown
          : skill.trigger.type === 'keydown'
            ? Phaser.Input.Keyboard.JustDown(key)
            : Phaser.Input.Keyboard.JustUp(key);

      if (!triggered) continue;
      if (!this.checkConditions(skill)) continue;

      this.executeActions(skill);
    }
  }

  private checkConditions(skill: SkillSchema): boolean {
    if (!skill.conditions?.length) return true;

    for (const cond of skill.conditions) {
      if (cond.type === 'onGround' && !this.onGroundFn()) return false;
      if (cond.type === 'inAir' && this.onGroundFn()) return false;
      if (cond.type === 'cooldownReady' && (this.cooldowns[skill.id] ?? 0) > 0) {
        return false;
      }
    }
    return true;
  }

  private executeActions(skill: SkillSchema): void {
    for (const action of skill.actions) {
      switch (action.type) {
        case 'jump':
          if (!skill.conditions?.some((c) => c.type === 'onGround') || this.onGroundFn()) {
            this.body.setVelocityY(-(action.force ?? 400));
          }
          break;
        case 'impulse':
          if (action.axis === 'x') {
            this.body.setVelocityX(action.speed ?? action.force ?? 200);
          } else {
            this.body.setVelocityY(-(action.force ?? 300));
          }
          break;
        case 'move':
          if (action.axis === 'x') {
            this.body.setVelocityX(action.speed ?? 0);
          } else {
            this.body.setVelocityY(action.speed ?? 0);
          }
          break;
        case 'dash': {
          const cd = action.cooldown ?? 500;
          if ((this.cooldowns[skill.id] ?? 0) > 0) break;
          const dir = this.body.velocity.x >= 0 ? 1 : -1;
          this.body.setVelocityX(dir * (action.distance ?? 120) * 4);
          this.cooldowns[skill.id] = cd;
          break;
        }
        case 'gravity':
          this.body.setGravityY(900 * (action.multiplier ?? 1));
          break;
        case 'scale': {
          const mult = action.multiplier ?? 1.5;
          const dur = action.duration ?? 400;
          this.scaleTween?.stop();
          this.scene.tweens.add({
            targets: this.sprite,
            scaleX: this.baseScale * mult,
            scaleY: this.baseScale * mult,
            duration: dur / 2,
            yoyo: true,
            onComplete: () => {
              this.sprite.setScale(this.baseScale);
            },
          });
          break;
        }
        case 'rotate': {
          const spin = action.spinSpeed ?? 360;
          const dur = action.duration ?? 500;
          this.scene.tweens.add({
            targets: this.sprite,
            angle: this.sprite.angle + (action.degrees ?? spin),
            duration: dur,
            onComplete: () => {
              this.sprite.setAngle(0);
            },
          });
          break;
        }
        case 'shoot': {
          const cd = action.cooldown ?? 300;
          if ((this.cooldowns[skill.id] ?? 0) > 0) break;
          const dir = this.sprite.flipX ? -1 : 1;
          this.projectiles?.fire(
            this.sprite.x + dir * 20,
            this.sprite.y,
            dir,
            action.projectileAssetId,
            action.projectileSpeed ?? 420,
            action.projectileLife ?? 2000
          );
          this.animCtrl?.triggerOneShot('shoot');
          this.cooldowns[skill.id] = cd;
          break;
        }
      }
    }
  }

  applyFriction(): void {
    const holdMove = this.skills.some((s) => {
      if (s.trigger.type !== 'hold') return false;
      const key = this.keys.get(s.id);
      return key?.isDown && s.actions.some((a) => a.type === 'move');
    });

    if (!holdMove && this.onGroundFn()) {
      this.body.setVelocityX(this.body.velocity.x * 0.8);
      if (Math.abs(this.body.velocity.x) < 10) this.body.setVelocityX(0);
    }
  }
}
