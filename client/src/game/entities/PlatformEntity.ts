import Phaser from 'phaser';
import type { AssetSchema, PlatformDef } from '../../types';
import { PlatformTileRenderer } from '../systems/PlatformTileRenderer';
import { platformHasMovement } from '../../data/platformPresets';

export class PlatformEntity {
  readonly def: PlatformDef;
  readonly visual: Phaser.GameObjects.Container;
  readonly bodySprite: Phaser.Physics.Arcade.Sprite;
  touchingPlayer = false;
  baseX: number;
  baseY: number;
  originX: number;
  originY: number;
  runtimeOnly: boolean;
  markedDestroyed = false;
  readonly scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    def: PlatformDef,
    _assets: AssetSchema[],
    tileRenderer: PlatformTileRenderer,
    allPlatforms: PlatformDef[],
    staticGroup: Phaser.Physics.Arcade.StaticGroup,
    editMode: boolean
  ) {
    this.scene = scene;
    this.def = def;
    this.baseX = def.x;
    this.baseY = def.y;
    this.originX = def.x;
    this.originY = def.y;
    this.runtimeOnly = def.runtimeOnly ?? false;

    const cx = def.x + def.w / 2;
    const cy = def.y + def.h / 2;

    this.bodySprite = staticGroup.create(cx, cy, 'platform-default') as Phaser.Physics.Arcade.Sprite;
    this.bodySprite.setDisplaySize(def.w, def.h);
    this.bodySprite.setVisible(false);
    this.bodySprite.refreshBody();
    this.bodySprite.setData('platformId', def.id);

    if (!def.solid) {
      this.bodySprite.body!.enable = false;
    }

    this.visual = scene.add.container(def.x, def.y);
    tileRenderer.buildVisual(def, allPlatforms, this.visual);

    if (editMode) {
      const hit = scene.add.rectangle(def.w / 2, def.h / 2, def.w, def.h, 0x8b4513, 0.25);
      hit.setStrokeStyle(2, 0x228b22);
      this.visual.add(hit);
      hit.setInteractive({ draggable: true });
      hit.setData('type', 'platform');
      hit.setData('id', def.id);
    }

    if (platformHasMovement(def)) {
      this.bodySprite.body!.checkCollision.none = false;
    }
  }

  get id(): string {
    return this.def.id;
  }

  get x(): number {
    return this.baseX;
  }

  get y(): number {
    return this.baseY;
  }

  get centerX(): number {
    return this.baseX + this.def.w / 2;
  }

  get centerY(): number {
    return this.baseY + this.def.h / 2;
  }

  get body(): Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null {
    return this.bodySprite.body;
  }

  setPosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.def.x = x;
    this.def.y = y;
    this.visual.setPosition(x, y);
    this.bodySprite.setPosition(x + this.def.w / 2, y + this.def.h / 2);
    this.bodySprite.refreshBody();
  }

  moveBy(dx: number, dy: number): void {
    this.setPosition(this.baseX + dx, this.baseY + dy);
  }

  setSolid(solid: boolean): void {
    this.def.solid = solid;
    if (this.bodySprite.body) {
      this.bodySprite.body.enable = solid;
    }
  }

  setAlpha(alpha: number): void {
    this.visual.setAlpha(alpha);
    this.bodySprite.setAlpha(alpha);
  }

  refreshTiles(
    tileRenderer: PlatformTileRenderer,
    allPlatforms: PlatformDef[],
    editMode: boolean
  ): void {
    tileRenderer.buildVisual(this.def, allPlatforms, this.visual);
    if (editMode) {
      const hit = this.scene.add.rectangle(
        this.def.w / 2,
        this.def.h / 2,
        this.def.w,
        this.def.h,
        0x8b4513,
        0.25
      );
      hit.setStrokeStyle(2, 0x228b22);
      this.visual.add(hit);
      hit.setInteractive({ draggable: true });
      hit.setData('type', 'platform');
      hit.setData('id', this.def.id);
    }
  }

  getDraggable(): Phaser.GameObjects.GameObject | null {
    for (const child of this.visual.list) {
      if (child.getData?.('type') === 'platform') return child;
    }
    return null;
  }

  destroy(): void {
    if (this.markedDestroyed) return;
    this.markedDestroyed = true;
    this.visual.destroy(true);
    this.bodySprite.destroy(true);
  }
}

export function clonePlatformDef(
  def: PlatformDef,
  overrides: Partial<PlatformDef> = {}
): PlatformDef {
  return {
    ...def,
    id: overrides.id ?? `p-runtime-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    rules: def.rules ? def.rules.map((r) => ({ ...r, actions: [...r.actions] })) : undefined,
    runtimeOnly: true,
    ...overrides,
  };
}
