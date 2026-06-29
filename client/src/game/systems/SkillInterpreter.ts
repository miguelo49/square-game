import Phaser from 'phaser';
import type { SkillAction, SkillSchema } from '../../types';
import { resolvePhaserKeyCode } from '../utils/phaserKeys';
import type { ProjectileManager } from './ProjectileManager';
import type { AnimationController } from './AnimationController';
import { ONE_SHOT_CLIPS, resolveActionAnimClip } from './skillAnimDefaults';
import { runSkillScript } from './SkillScriptRunner';

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
  private airJumpsUsed = 0;
  /** True after a ground jump until the player lands again */
  private groundJumpUsed = false;
  private jumpBufferMs = 0;
  private static readonly JUMP_BUFFER_MS = 140;

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
      const keyCode = resolvePhaserKeyCode(skill.trigger.key);
      const key = this.scene.input.keyboard.addKey(keyCode);
      this.keys.set(skill.id, key);
    }
  }

  update(_time: number, delta: number): void {
    this.updateJumpState();

    for (const skillId of Object.keys(this.cooldowns)) {
      this.cooldowns[skillId] = Math.max(0, this.cooldowns[skillId] - delta);
    }

    this.processJumpBuffer(delta);
    this.processJumpKeys();

    for (const skill of this.skills) {
      if (this.isJumpSkill(skill)) continue;

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

  private updateJumpState(): void {
    const onGround = this.onGroundFn();
    const vy = this.body.velocity.y;

    if (onGround && vy >= -20) {
      this.groundJumpUsed = false;
      this.airJumpsUsed = 0;
    }
  }

  private isJumpSkill(skill: SkillSchema): boolean {
    return skill.actions.some((a) => a.type === 'jump' || (a.type === 'impulse' && a.axis === 'y'));
  }

  private isGroundJumpSkill(skill: SkillSchema): boolean {
    return skill.conditions?.some((c) => c.type === 'onGround') ?? false;
  }

  private isAirJumpSkill(skill: SkillSchema): boolean {
    return (
      skill.conditions?.some((c) => c.type === 'airJumpAvailable' || c.type === 'inAir') ?? false
    );
  }

  private canGroundJump(): boolean {
    return this.onGroundFn();
  }

  private canAirJump(): boolean {
    return this.groundJumpUsed && this.airJumpsUsed < 1;
  }

  private bufferJumpInput(): void {
    this.jumpBufferMs = SkillInterpreter.JUMP_BUFFER_MS;
  }

  private processJumpBuffer(delta: number): void {
    if (this.jumpBufferMs <= 0) return;
    this.jumpBufferMs -= delta;
    if (this.tryConsumeJump()) {
      this.jumpBufferMs = 0;
    }
  }

  private processJumpKeys(): void {
    const jumpSkills = this.skills.filter((s) => this.isJumpSkill(s) && s.trigger.type === 'keydown');
    const keysChecked = new Set<number>();

    for (const skill of jumpSkills) {
      const key = this.keys.get(skill.id);
      if (!key) continue;
      if (keysChecked.has(key.keyCode)) continue;

      if (Phaser.Input.Keyboard.JustDown(key)) {
        keysChecked.add(key.keyCode);
        if (!this.tryConsumeJump()) {
          this.bufferJumpInput();
        }
      }
    }
  }

  /** Ground jump first, then air jump. Returns true if a jump was executed. */
  private tryConsumeJump(): boolean {
    const jumpSkills = this.skills.filter((s) => this.isJumpSkill(s));

    const groundSkill = jumpSkills.find((s) => this.isGroundJumpSkill(s));
    if (groundSkill && this.canGroundJump() && this.checkConditions(groundSkill)) {
      this.executeActions(groundSkill);
      return true;
    }

    const airSkill = jumpSkills.find((s) => this.isAirJumpSkill(s));
    if (airSkill && this.canAirJump() && this.checkConditions(airSkill)) {
      this.executeActions(airSkill);
      return true;
    }

    return false;
  }

  private checkConditions(skill: SkillSchema): boolean {
    if (!skill.conditions?.length) return true;

    for (const cond of skill.conditions) {
      if (cond.type === 'onGround' && !this.onGroundFn()) return false;
      if (cond.type === 'inAir' && !this.canAirJump() && this.onGroundFn()) return false;
      if (cond.type === 'airJumpAvailable') {
        if (!this.canAirJump()) return false;
      }
      if (cond.type === 'cooldownReady' && (this.cooldowns[skill.id] ?? 0) > 0) {
        return false;
      }
    }
    return true;
  }

  private triggerActionAnim(action: SkillAction, skill: SkillSchema): void {
    const clip = resolveActionAnimClip(action, skill.animClip);
    if (clip && ONE_SHOT_CLIPS.has(clip)) {
      this.animCtrl?.triggerOneShot(clip);
    }
  }

  private usesAirJump(skill: SkillSchema): boolean {
    return this.isAirJumpSkill(skill);
  }

  private markGroundJump(skill: SkillSchema): void {
    if (this.isGroundJumpSkill(skill)) {
      this.groundJumpUsed = true;
    }
  }

  private consumeAirJump(skill: SkillSchema): void {
    if (this.usesAirJump(skill)) {
      this.airJumpsUsed++;
    }
  }

  private executeActions(skill: SkillSchema): void {
    for (const action of skill.actions) {
      switch (action.type) {
        case 'jump':
          if (!skill.conditions?.some((c) => c.type === 'onGround') || this.onGroundFn()) {
            this.body.setVelocityY(-(action.force ?? 400));
          }
          this.markGroundJump(skill);
          this.consumeAirJump(skill);
          this.triggerActionAnim(action, skill);
          break;
        case 'impulse':
          if (action.axis === 'x') {
            this.body.setVelocityX(action.speed ?? action.force ?? 200);
          } else {
            this.body.setVelocityY(-(action.force ?? 300));
          }
          this.markGroundJump(skill);
          this.consumeAirJump(skill);
          this.triggerActionAnim(action, skill);
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
          this.triggerActionAnim(action, skill);
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
          this.triggerActionAnim(action, skill);
          this.cooldowns[skill.id] = cd;
          break;
        }
        case 'custom':
          if (action.script) {
            runSkillScript(action.script, {
              body: this.body,
              sprite: this.sprite,
              onGroundFn: this.onGroundFn,
              projectiles: this.projectiles,
              animCtrl: this.animCtrl,
              skillId: skill.id,
              getCooldown: (id) => this.cooldowns[id] ?? 0,
              setCooldownFor: (id, ms) => {
                this.cooldowns[id] = ms;
              },
            });
          }
          this.triggerActionAnim(action, skill);
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
