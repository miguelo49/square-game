import Phaser from 'phaser';
import type { SkillSchema } from '../../types';
import { toPhaserKey } from '../utils/phaserKeys';

interface CooldownState {
  [skillId: string]: number;
}

export class SkillInterpreter {
  private skills: SkillSchema[] = [];
  private keys: Map<string, Phaser.Input.Keyboard.Key> = new Map();
  private cooldowns: CooldownState = {};
  private scene: Phaser.Scene;
  private body: Phaser.Physics.Arcade.Body;
  private onGroundFn: () => boolean;

  constructor(
    scene: Phaser.Scene,
    body: Phaser.Physics.Arcade.Body,
    onGroundFn: () => boolean
  ) {
    this.scene = scene;
    this.body = body;
    this.onGroundFn = onGroundFn;
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
          if (this.onGroundFn()) {
            this.body.setVelocityY(-(action.force ?? 400));
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
