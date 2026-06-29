import Phaser from 'phaser';
import type { PlatformAction, PlatformDef, PlatformRule } from '../../types';
import { resolvePlatformRules } from '../../data/platformPresets';
import { PlatformEntity, clonePlatformDef } from '../entities/PlatformEntity';
import { runPlatformScript } from './PlatformScriptRunner';

interface RuleState {
  rule: PlatformRule;
  consumed: boolean;
  touchTimer: number;
  intervalTimer: number;
  moveOffset: number;
  moveDir: number;
  pathIndex: number;
  pathProgress: number;
  fading: boolean;
}

export type PlatformSpawnCallback = (def: PlatformDef) => PlatformEntity;
export type PlatformDestroyCallback = (entity: PlatformEntity) => void;

export class PlatformBehaviorRunner {
  private entities: PlatformEntity[] = [];
  private states = new Map<string, RuleState[]>();
  private onSpawn?: PlatformSpawnCallback;
  private onDestroy?: PlatformDestroyCallback;

  setEntities(entities: PlatformEntity[]): void {
    this.entities = entities;
    this.states.clear();
    for (const e of entities) {
      const rules = resolvePlatformRules(e.def);
      this.states.set(
        e.id,
        rules.map((rule) => ({
          rule,
          consumed: false,
          touchTimer: 0,
          intervalTimer: 0,
          moveOffset: 0,
          moveDir: 1,
          pathIndex: 0,
          pathProgress: 0,
          fading: false,
        }))
      );
    }
  }

  addEntity(entity: PlatformEntity): void {
    this.entities.push(entity);
    const rules = resolvePlatformRules(entity.def);
    this.states.set(
      entity.id,
      rules.map((rule) => ({
        rule,
        consumed: false,
        touchTimer: 0,
        intervalTimer: 0,
        moveOffset: 0,
        moveDir: 1,
        pathIndex: 0,
        pathProgress: 0,
        fading: false,
      }))
    );
  }

  removeEntity(entity: PlatformEntity): void {
    this.entities = this.entities.filter((e) => e.id !== entity.id);
    this.states.delete(entity.id);
  }

  setSpawnCallback(cb: PlatformSpawnCallback): void {
    this.onSpawn = cb;
  }

  setDestroyCallback(cb: PlatformDestroyCallback): void {
    this.onDestroy = cb;
  }

  update(
    delta: number,
    player: Phaser.Physics.Arcade.Sprite,
    camera: Phaser.Cameras.Scene2D.Camera
  ): void {
    for (const entity of [...this.entities]) {
      if (entity.markedDestroyed) continue;

      const prevTouch = entity.touchingPlayer;
      entity.touchingPlayer = this.isPlayerOnPlatform(player, entity);

      const ruleStates = this.states.get(entity.id) ?? [];
      let dx = 0;
      let dy = 0;

      for (const rs of ruleStates) {
        if (rs.consumed && rs.rule.once) continue;
        if (rs.fading) continue;

        const triggered = this.shouldTrigger(rs, entity, prevTouch, player, camera, delta);
        if (!triggered) continue;

        const move = this.executeActions(rs, entity, delta, player);
        dx += move.dx;
        dy += move.dy;
      }

      if (dx !== 0 || dy !== 0) {
        const prevX = entity.baseX;
        const prevY = entity.baseY;
        entity.moveBy(dx, dy);
        this.carryPlayer(player, entity, entity.baseX - prevX, entity.baseY - prevY);
      }
    }
  }

  private isPlayerOnPlatform(
    player: Phaser.Physics.Arcade.Sprite,
    entity: PlatformEntity
  ): boolean {
    const body = player.body as Phaser.Physics.Arcade.Body;
    if (!body.blocked.down && !body.touching.down) return false;
    const px = player.x;
    const py = player.y + 16;
    return (
      px >= entity.baseX &&
      px <= entity.baseX + entity.def.w &&
      py >= entity.baseY - 4 &&
      py <= entity.baseY + entity.def.h
    );
  }

  private carryPlayer(
    player: Phaser.Physics.Arcade.Sprite,
    entity: PlatformEntity,
    dx: number,
    dy: number
  ): void {
    if (!entity.touchingPlayer) return;
    if (dx === 0 && dy === 0) return;
    player.x += dx;
    player.y += dy;
  }

  private shouldTrigger(
    rs: RuleState,
    entity: PlatformEntity,
    prevTouch: boolean,
    _player: Phaser.Physics.Arcade.Sprite,
    camera: Phaser.Cameras.Scene2D.Camera,
    delta: number
  ): boolean {
    const { rule } = rs;

    switch (rule.trigger) {
      case 'always':
        return true;
      case 'onTouch':
        return entity.touchingPlayer && !prevTouch;
      case 'onLeave':
        return !entity.touchingPlayer && prevTouch;
      case 'afterTouch':
        if (!entity.touchingPlayer) {
          rs.touchTimer = 0;
          return false;
        }
        rs.touchTimer += delta;
        return rs.touchTimer >= (rule.delay ?? 400);
      case 'interval':
        rs.intervalTimer += delta;
        if (rs.intervalTimer >= (rule.interval ?? 1000)) {
          rs.intervalTimer = 0;
          return true;
        }
        return false;
      case 'offScreen': {
        const margin = rule.offScreenMargin ?? 64;
        const view = camera.worldView;
        const cx = entity.centerX;
        const cy = entity.centerY;
        const off =
          cx < view.x - margin ||
          cx > view.right + margin ||
          cy < view.y - margin ||
          cy > view.bottom + margin;
        return off;
      }
      default:
        return false;
    }
  }

  private executeActions(
    rs: RuleState,
    entity: PlatformEntity,
    delta: number,
    player: Phaser.Physics.Arcade.Sprite
  ): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;

    for (const action of rs.rule.actions) {
      const result = this.runAction(action, rs, entity, delta, player);
      dx += result.dx;
      dy += result.dy;
    }

    if (rs.rule.once) rs.consumed = true;
    return { dx, dy };
  }

  private runAction(
    action: PlatformAction,
    rs: RuleState,
    entity: PlatformEntity,
    delta: number,
    player: Phaser.Physics.Arcade.Sprite
  ): { dx: number; dy: number } {
    switch (action.type) {
      case 'move':
        return this.runMoveAction(action, rs, entity, delta);
      case 'path':
        return this.runPathAction(action, rs, entity, delta);
      case 'fade':
        this.runFadeAction(action, rs, entity);
        return { dx: 0, dy: 0 };
      case 'spawn':
        this.runSpawnAction(action, entity);
        if (rs.rule.once) rs.consumed = true;
        return { dx: 0, dy: 0 };
      case 'setSolid':
        entity.setSolid(action.solid ?? true);
        return { dx: 0, dy: 0 };
      case 'destroy':
        this.onDestroy?.(entity);
        return { dx: 0, dy: 0 };
      case 'custom':
        if (action.script) {
          runPlatformScript(action.script, {
            entity,
            player,
            delta,
            spawnClone: (offsets) => {
              const clone = clonePlatformDef(entity.def, {
                x: entity.baseX + (offsets?.x ?? 0),
                y: entity.baseY + (offsets?.y ?? 0),
              });
              this.onSpawn?.(clone);
            },
            fade: (duration, destroyAfter) => {
              this.runFadeAction({ type: 'fade', duration, destroyAfter }, rs, entity);
            },
            setSolid: (solid) => entity.setSolid(solid),
            destroy: () => this.onDestroy?.(entity),
          });
        }
        return { dx: 0, dy: 0 };
      default:
        return { dx: 0, dy: 0 };
    }
  }

  private runMoveAction(
    action: PlatformAction,
    rs: RuleState,
    entity: PlatformEntity,
    delta: number
  ): { dx: number; dy: number } {
    const speed = action.speed ?? 60;
    const dist = action.distance ?? 0;
    const step = (speed * delta) / 1000;

    if (action.pingPong && dist > 0) {
      rs.moveOffset += step * rs.moveDir;
      if (rs.moveOffset >= dist) {
        rs.moveOffset = dist;
        rs.moveDir = -1;
      } else if (rs.moveOffset <= 0) {
        rs.moveOffset = 0;
        rs.moveDir = 1;
      }
      const axis = action.axis ?? 'y';
      const targetX = axis === 'x' ? entity.originX + rs.moveOffset : entity.originX;
      const targetY = axis === 'y' ? entity.originY + rs.moveOffset : entity.originY;
      return {
        dx: targetX - entity.baseX,
        dy: targetY - entity.baseY,
      };
    }

    if (action.axis === 'x') return { dx: step, dy: 0 };
    return { dx: 0, dy: step };
  }

  private runPathAction(
    action: PlatformAction,
    rs: RuleState,
    entity: PlatformEntity,
    delta: number
  ): { dx: number; dy: number } {
    const points = action.waypoints;
    if (!points?.length) return { dx: 0, dy: 0 };

    const speed = action.speed ?? 80;
    const step = (speed * delta) / 1000;
    const from = points[rs.pathIndex]!;
    const to = points[(rs.pathIndex + 1) % points.length]!;
    const startX = entity.baseX + from.x;
    const startY = entity.baseY + from.y;
    const endX = entity.baseX + to.x;
    const endY = entity.baseY + to.y;
    const total = Math.hypot(endX - startX, endY - startY) || 1;

    rs.pathProgress += step;
    if (rs.pathProgress >= total) {
      rs.pathProgress = 0;
      rs.pathIndex = (rs.pathIndex + 1) % points.length;
      return { dx: 0, dy: 0 };
    }

    const t = rs.pathProgress / total;
    const targetX = startX + (endX - startX) * t;
    const targetY = startY + (endY - startY) * t;
    return {
      dx: targetX - entity.centerX,
      dy: targetY - entity.centerY,
    };
  }

  private runFadeAction(
    action: PlatformAction,
    rs: RuleState,
    entity: PlatformEntity
  ): void {
    if (rs.fading) return;
    rs.fading = true;
    const duration = action.duration ?? 500;
    entity.scene.tweens.add({
      targets: [entity.visual, entity.bodySprite],
      alpha: 0,
      duration,
      onComplete: () => {
        if (action.destroyAfter !== false) {
          this.onDestroy?.(entity);
        } else {
          entity.setSolid(false);
        }
      },
    });
  }

  private runSpawnAction(action: PlatformAction, entity: PlatformEntity): void {
    const clone = clonePlatformDef(entity.def, {
      x: entity.baseX + (action.offsetX ?? 0),
      y: entity.baseY + (action.offsetY ?? 400),
    });
    this.onSpawn?.(clone);
  }
}
