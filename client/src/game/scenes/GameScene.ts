import Phaser from 'phaser';
import type { LevelSchema, SkillSchema, AssetSchema, GameMode, SelectedEnemyConfig, RunResult } from '../../types';
import { CameraController } from '../systems/CameraController';
import { EditorGrid } from '../systems/EditorGrid';
import { EditorGhost } from '../systems/EditorGhost';
import { SkillInterpreter } from '../systems/SkillInterpreter';
import { TriangleEnemy } from '../entities/TriangleEnemy';
import { createEnemy, presetToEnemyDef, DEFAULT_ENEMY_SELECTION } from '../entities/enemyRegistry';
import {
  createDefaultSquareTexture,
  createDefaultPlatformTexture,
  createDefaultEnemyTexture,
  createSpawnMarkerTexture,
  createPortalTexture,
  createProjectileTexture,
  registerAssetClips,
  assetTextureKey,
} from '../utils/textures';
import { initSpriteAnimation, AnimationController } from '../systems/AnimationController';
import { ProjectileManager } from '../systems/ProjectileManager';
import { migrateLevel, snapToPlatformSurface, PORTAL_H } from '../utils/placement';
import { GAME_CAPTURE_KEYS } from '../utils/phaserKeys';
import { GRID_SNAP } from '../../data/retroLimits';

export interface GameSceneCallbacks {
  onDeath?: () => void;
  onWin?: (result: RunResult) => void;
  onEditorSelect?: (type: string, id: string) => void;
}

type DraggableObject =
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Image
  | TriangleEnemy;

type HitEntity = { type: 'enemy' | 'platform'; id: string };

export class GameScene extends Phaser.Scene {
  private level!: LevelSchema;
  private skills: SkillSchema[] = [];
  private assets: AssetSchema[] = [];
  private mode: GameMode = 'play';
  private player!: Phaser.Physics.Arcade.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemyGroup?: Phaser.Physics.Arcade.Group;
  private enemies: TriangleEnemy[] = [];
  private editorEnemySprites: Phaser.GameObjects.Image[] = [];
  private cameraCtrl!: CameraController;
  private skillInterpreter!: SkillInterpreter;
  private editorGrid?: EditorGrid;
  private editorGhost?: EditorGhost;
  private spawnMarker?: Phaser.GameObjects.Image;
  private portalSprite?: Phaser.GameObjects.Image;
  private portalZone?: Phaser.Physics.Arcade.StaticGroup;
  private portalMarker?: Phaser.GameObjects.Image;
  private callbacks: GameSceneCallbacks = {};
  private editorTool: string = 'select';
  private selectedEnemy: SelectedEnemyConfig = DEFAULT_ENEMY_SELECTION;
  private platformSprites: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private deleteHighlight?: Phaser.GameObjects.Rectangle;
  private selectionHighlight?: Phaser.GameObjects.Rectangle;
  private selectedEntityId: string | null = null;
  private playerAnimCtrl?: AnimationController | null;
  private projectileManager?: ProjectileManager;
  private won = false;
  private runStartedAt = 0;
  private deathCount = 0;

  constructor() {
    super('GameScene');
  }

  init(data: {
    level: LevelSchema;
    skills?: SkillSchema[];
    assets?: AssetSchema[];
    mode?: GameMode;
    callbacks?: GameSceneCallbacks;
    editorTool?: string;
    selectedEnemy?: SelectedEnemyConfig;
    selectedEntityId?: string | null;
  }): void {
    this.level = migrateLevel(data.level);
    this.skills = data.skills ?? [];
    this.assets = data.assets ?? [];
    this.mode = data.mode ?? 'play';
    this.callbacks = data.callbacks ?? {};
    this.editorTool = data.editorTool ?? 'select';
    this.selectedEnemy = data.selectedEnemy ?? DEFAULT_ENEMY_SELECTION;
    this.selectedEntityId = data.selectedEntityId ?? null;
    this.won = false;
    this.runStartedAt = Date.now();
    this.deathCount = 0;
  }

  create(): void {
    this.editorGrid?.destroy();
    this.editorGrid = undefined;
    this.editorGhost?.destroy();
    this.editorGhost = undefined;
    this.deleteHighlight?.destroy();
    this.deleteHighlight = undefined;
    this.selectionHighlight?.destroy();
    this.selectionHighlight = undefined;
    this.playerAnimCtrl = undefined;
    this.portalZone?.destroy(true);
    this.portalZone = undefined;
    this.enemyGroup = undefined;

    createDefaultSquareTexture(this);
    createDefaultPlatformTexture(this);
    createDefaultEnemyTexture(this);
    createSpawnMarkerTexture(this);
    createPortalTexture(this);
    createProjectileTexture(this);

    for (const asset of this.assets) {
      registerAssetClips(this, asset);
    }

    this.physics.world.setBounds(0, 0, this.level.width, this.level.height);
    this.cameras.main.setBackgroundColor(this.level.backgroundColor);

    this.cameraCtrl = new CameraController(this);
    this.cameraCtrl.setBounds(this.level.width, this.level.height);
    this.cameraCtrl.setMode(this.mode === 'play' ? 'follow' : 'free');

    if (this.mode === 'edit') {
      this.editorGrid = new EditorGrid(this, this.level.width, this.level.height);
      this.editorGhost = new EditorGhost(this);
      this.deleteHighlight = this.add.rectangle(0, 0, 32, 32, 0xff0000, 0.35);
      this.deleteHighlight.setStrokeStyle(2, 0xff4444);
      this.deleteHighlight.setVisible(false);
      this.deleteHighlight.setDepth(1000);
      this.selectionHighlight = this.add.rectangle(0, 0, 32, 32);
      this.selectionHighlight.setStrokeStyle(3, 0xffff00);
      this.selectionHighlight.setFillStyle(0xffff00, 0.15);
      this.selectionHighlight.setVisible(false);
      this.selectionHighlight.setDepth(999);
    }

    this.platforms = this.physics.add.staticGroup();
    this.buildLevel();

    const playerAsset = this.assets.find((a) => a.category === 'player');
    const playerTex = playerAsset ? assetTextureKey(playerAsset) : 'square-default';
    this.player = this.physics.add.sprite(
      this.level.spawn.x,
      this.level.spawn.y,
      playerTex
    );
    this.player.setDisplaySize(32, 32);
    this.player.body!.setSize(28, 28);
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0.05);
    this.playerAnimCtrl = initSpriteAnimation(this.player, playerAsset);

    if (this.mode === 'play') {
      this.player.setVisible(true);
      this.player.body!.enable = true;
    } else {
      this.player.setVisible(false);
      this.player.body!.enable = false;
    }

    this.skillInterpreter = new SkillInterpreter(
      this,
      this.player,
      () => (this.player.body as Phaser.Physics.Arcade.Body).blocked.down
    );
    this.skillInterpreter.setAnimationController(this.playerAnimCtrl ?? undefined);
    this.skillInterpreter.loadSkills(this.skills);

    if (this.mode === 'play') {
      this.input.keyboard?.clearCaptures();
      this.projectileManager = new ProjectileManager(this);
      this.projectileManager.setAssets(this.assets);
      this.skillInterpreter.setProjectileManager(this.projectileManager);
      this.input.keyboard?.addCapture([...GAME_CAPTURE_KEYS]);
      this.setupPlayPhysics();
      this.cameraCtrl.followTarget(this.player);
    } else {
      this.setupEditorInput();
    }

    this.events.on('update-level', this.handleLevelUpdate, this);
    this.events.on('set-tool', (tool: string) => {
      this.editorTool = tool;
      if (tool !== 'platform') {
        this.editorGhost?.hide();
      }
      if (tool !== 'delete') {
        this.deleteHighlight?.setVisible(false);
      }
    }, this);
    this.events.on('set-selected-enemy', (cfg: SelectedEnemyConfig) => {
      this.selectedEnemy = cfg;
    }, this);
    this.events.on('set-selected-entity', (id: string | null) => {
      this.selectedEntityId = id;
      this.updateSelectionHighlight();
    }, this);
  }

  private updateSelectionHighlight(): void {
    if (!this.selectionHighlight || this.mode !== 'edit') return;
    if (!this.selectedEntityId) {
      this.selectionHighlight.setVisible(false);
      return;
    }
    const e = this.level.enemies.find((en) => en.id === this.selectedEntityId);
    if (!e) {
      this.selectionHighlight.setVisible(false);
      return;
    }
    this.selectionHighlight.setPosition(e.x, e.y);
    this.selectionHighlight.setSize(32, 32);
    this.selectionHighlight.setVisible(true);
  }

  private enemyTexture(def: { assetId?: string }): string {
    if (def.assetId) {
      const asset = this.assets.find((a) => a.id === def.assetId);
      if (asset) return assetTextureKey(asset, 'idle');
      return `asset-${def.assetId}`;
    }
    return 'enemy-default';
  }

  private findEntityAt(worldX: number, worldY: number): HitEntity | null {
    for (const e of this.level.enemies) {
      if (Math.abs(worldX - e.x) <= 16 && Math.abs(worldY - e.y) <= 16) {
        return { type: 'enemy', id: e.id };
      }
    }
    for (const p of this.level.platforms) {
      if (
        worldX >= p.x &&
        worldX <= p.x + p.w &&
        worldY >= p.y &&
        worldY <= p.y + p.h
      ) {
        return { type: 'platform', id: p.id };
      }
    }
    return null;
  }

  private deleteAt(worldX: number, worldY: number): boolean {
    const hit = this.findEntityAt(worldX, worldY);
    if (!hit) return false;
    if (hit.type === 'enemy') {
      this.level.enemies = this.level.enemies.filter((e) => e.id !== hit.id);
      this.rebuildAndEmit();
      return true;
    }
    if (hit.type === 'platform') {
      this.level.platforms = this.level.platforms.filter((p) => p.id !== hit.id);
      this.rebuildAndEmit();
      return true;
    }
    return false;
  }

  private buildLevel(): void {
    this.platformSprites.forEach((s) => s.destroy());
    this.platformSprites.clear();
    this.platforms.clear(true, true);
    this.enemies.forEach((e) => e.destroy());
    this.enemies = [];
    this.editorEnemySprites.forEach((s) => s.destroy());
    this.editorEnemySprites = [];
    this.spawnMarker?.destroy();
    this.spawnMarker = undefined;
    this.portalSprite?.destroy();
    this.portalSprite = undefined;
    this.portalMarker?.destroy();
    this.portalMarker = undefined;
    if (this.portalZone) {
      this.portalZone.destroy(true);
      this.portalZone = undefined;
    }

    for (const p of this.level.platforms) {
      const plat = this.platforms.create(
        p.x + p.w / 2,
        p.y + p.h / 2,
        'platform-default'
      );
      plat.setDisplaySize(p.w, p.h);
      plat.refreshBody();

      if (this.mode === 'edit') {
        const rect = this.add.rectangle(
          p.x + p.w / 2,
          p.y + p.h / 2,
          p.w,
          p.h,
          0x8b4513,
          0.6
        );
        rect.setStrokeStyle(2, 0x228b22);
        rect.setInteractive({ draggable: true });
        rect.setData('type', 'platform');
        rect.setData('id', p.id);
        this.platformSprites.set(p.id, rect);
      }
    }

    for (const e of this.level.enemies) {
      if (this.mode === 'edit') {
        const img = this.add.image(e.x, e.y, this.enemyTexture(e));
        img.setDisplaySize(32, 32);
        img.setInteractive({ draggable: true });
        img.setData('type', 'enemy');
        img.setData('id', e.id);
        this.editorEnemySprites.push(img);
      } else {
        const enemy = createEnemy(this, e, this.assets);
        this.enemies.push(enemy);
      }
    }

    this.updateSelectionHighlight();

    if (this.mode === 'edit') {
      this.spawnMarker = this.add.image(
        this.level.spawn.x,
        this.level.spawn.y,
        'spawn-marker'
      );
      this.spawnMarker.setDisplaySize(32, 32);
      this.spawnMarker.setInteractive({ draggable: true });
      this.spawnMarker.setData('type', 'spawn');
      this.spawnMarker.setData('id', 'spawn');

      this.portalMarker = this.add.image(
        this.level.portal.x,
        this.level.portal.y,
        'portal-default'
      );
      this.portalMarker.setDisplaySize(this.level.portal.w, this.level.portal.h);
      this.portalMarker.setInteractive({ draggable: true });
      this.portalMarker.setData('type', 'portal');
      this.portalMarker.setData('id', 'portal');
    } else {
      this.portalSprite = this.add.image(
        this.level.portal.x,
        this.level.portal.y,
        'portal-default'
      );
      this.portalSprite.setDisplaySize(this.level.portal.w, this.level.portal.h);

      this.portalZone = this.physics.add.staticGroup();
      const zone = this.portalZone.create(
        this.level.portal.x,
        this.level.portal.y,
        'portal-default'
      );
      zone.setDisplaySize(this.level.portal.w, this.level.portal.h);
      zone.setVisible(false);
      zone.refreshBody();
    }

    this.editorGrid?.resize(this.level.width, this.level.height);
  }

  private setupPlayPhysics(): void {
    this.enemyGroup = this.physics.add.group();

    for (const enemy of this.enemies) {
      this.enemyGroup.add(enemy);
    }

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemyGroup, this.platforms);

    this.projectileManager?.setupColliders(this.platforms, this.enemies);

    for (const enemy of this.enemies) {
      this.physics.add.overlap(this.player, enemy, () => {
        this.handleDeath();
      });
    }

    this.setupPortalOverlap();
  }

  private setupPortalOverlap(): void {
    if (this.portalZone) {
      this.physics.add.overlap(this.player, this.portalZone, () => {
        this.handleWin();
      });
    }
  }

  private setupEditorInput(): void {
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('dragstart');
    this.input.off('drag');
    this.input.off('dragend');

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      if (this.editorTool === 'delete' && this.deleteHighlight) {
        const hit = this.findEntityAt(world.x, world.y);
        if (hit) {
          if (hit.type === 'enemy') {
            const e = this.level.enemies.find((en) => en.id === hit.id);
            if (e) {
              this.deleteHighlight.setPosition(e.x, e.y);
              this.deleteHighlight.setSize(32, 32);
              this.deleteHighlight.setVisible(true);
            }
          } else {
            const p = this.level.platforms.find((pl) => pl.id === hit.id);
            if (p) {
              this.deleteHighlight.setPosition(p.x + p.w / 2, p.y + p.h / 2);
              this.deleteHighlight.setSize(p.w, p.h);
              this.deleteHighlight.setVisible(true);
            }
          }
        } else {
          this.deleteHighlight.setVisible(false);
        }
      }

      if (this.editorTool !== 'platform') {
        this.editorGhost?.hide();
        return;
      }
      this.editorGhost?.showTopLeft(world.x, world.y);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      if (pointer.rightButtonDown()) {
        if (this.deleteAt(world.x, world.y)) return;
      }

      if (!pointer.leftButtonDown()) return;

      if (this.editorTool === 'delete') {
        this.deleteAt(world.x, world.y);
        return;
      }

      if (this.editorTool === 'select') {
        const hit = this.findEntityAt(world.x, world.y);
        if (hit?.type === 'enemy') {
          this.selectedEntityId = hit.id;
          this.updateSelectionHighlight();
          this.callbacks.onEditorSelect?.('enemy', hit.id);
        } else {
          this.selectedEntityId = null;
          this.updateSelectionHighlight();
          this.callbacks.onEditorSelect?.('', '');
        }
        return;
      }

      const x = Math.round(world.x / GRID_SNAP) * GRID_SNAP;
      const y = Math.round(world.y / GRID_SNAP) * GRID_SNAP;

      if (this.editorTool === 'platform') {
        const id = `p-${Date.now()}`;
        this.level.platforms.push({ id, x, y, w: 128, h: 32, solid: true });
        this.rebuildAndEmit();
      } else if (this.editorTool === 'enemy') {
        const id = `e-${Date.now()}`;
        const pos = snapToPlatformSurface(x, y, this.level.platforms);
        this.level.enemies.push(presetToEnemyDef(pos, id, this.selectedEnemy));
        this.rebuildAndEmit();
      } else if (this.editorTool === 'spawn') {
        const pos = snapToPlatformSurface(x, y, this.level.platforms);
        this.level.spawn = pos;
        this.rebuildAndEmit();
      } else if (this.editorTool === 'portal') {
        const pos = snapToPlatformSurface(x, y, this.level.platforms, PORTAL_H);
        this.level.portal = {
          ...this.level.portal,
          x: pos.x,
          y: pos.y,
        };
        this.rebuildAndEmit();
      }
    });

    this.input.on('drag', (
      _pointer: Phaser.Input.Pointer,
      gameObject: Phaser.GameObjects.GameObject,
      dragX: number,
      dragY: number
    ) => {
      const go = gameObject as unknown as DraggableObject;
      go.x = Math.round(dragX / GRID_SNAP) * GRID_SNAP;
      go.y = Math.round(dragY / GRID_SNAP) * GRID_SNAP;
    });

    this.input.on('dragend', (
      _pointer: Phaser.Input.Pointer,
      gameObject: Phaser.GameObjects.GameObject
    ) => {
      const type = gameObject.getData('type') as string;
      const id = gameObject.getData('id') as string;
      const go = gameObject as unknown as DraggableObject;
      let x = go.x;
      let y = go.y;

      if (type === 'platform') {
        const p = this.level.platforms.find((pl) => pl.id === id);
        if (p) {
          p.x = x - p.w / 2;
          p.y = y - p.h / 2;
        }
      } else if (type === 'enemy') {
        const snapped = snapToPlatformSurface(x, y, this.level.platforms);
        x = snapped.x;
        y = snapped.y;
        const e = this.level.enemies.find((en) => en.id === id);
        if (e) {
          e.x = x;
          e.y = y;
        }
      } else if (type === 'spawn') {
        const snapped = snapToPlatformSurface(x, y, this.level.platforms);
        this.level.spawn = snapped;
      } else if (type === 'portal') {
        const snapped = snapToPlatformSurface(x, y, this.level.platforms, PORTAL_H);
        this.level.portal = { ...this.level.portal, x: snapped.x, y: snapped.y };
      }

      this.rebuildAndEmit();
    });

    const draggables = [
      ...this.platformSprites.values(),
      ...this.editorEnemySprites,
      this.spawnMarker,
      this.portalMarker,
    ].filter(Boolean) as Phaser.GameObjects.GameObject[];

    this.input.setDraggable(draggables);
  }

  private rebuildAndEmit(): void {
    this.buildLevel();
    if (this.mode === 'edit') {
      this.setupEditorInput();
    }
    this.game.events.emit('level-changed', this.level);
  }

  private handleLevelUpdate(level: LevelSchema): void {
    this.level = migrateLevel(level);
    this.buildLevel();
    if (this.mode === 'edit') {
      this.setupEditorInput();
    } else {
      this.setupPlayPhysics();
    }
  }

  private handleDeath(): void {
    if (this.won) return;
    this.deathCount++;
    this.playerAnimCtrl?.triggerOneShot('hurt');
    this.player.setPosition(this.level.spawn.x, this.level.spawn.y);
    this.player.setVelocity(0, 0);
    this.callbacks.onDeath?.();
  }

  private handleWin(): void {
    if (this.won) return;
    this.won = true;
    this.player.setVelocity(0, 0);
    const timeMs = Date.now() - this.runStartedAt;
    this.callbacks.onWin?.({ timeMs, deaths: this.deathCount });
  }

  getRunElapsedMs(): number {
    return Date.now() - this.runStartedAt;
  }

  update(_time: number, delta: number): void {
    if (this.mode === 'play' && !this.won && this.skillInterpreter) {
      this.skillInterpreter.update(_time, delta);
      this.skillInterpreter.applyFriction();
      this.playerAnimCtrl?.update(_time);
      this.projectileManager?.update(delta);
      for (const enemy of this.enemies) {
        enemy.update(this.player, delta, _time);
      }
    }

    if (this.mode === 'edit') {
      const cursors = this.input.keyboard?.createCursorKeys();
      if (cursors) {
        const speed = 8;
        if (cursors.left.isDown) this.cameraCtrl.panBy(-speed, 0);
        if (cursors.right.isDown) this.cameraCtrl.panBy(speed, 0);
        if (cursors.up.isDown) this.cameraCtrl.panBy(0, -speed);
        if (cursors.down.isDown) this.cameraCtrl.panBy(0, speed);
      }
    }
  }

  getLevel(): LevelSchema {
    return this.level;
  }

  shutdown(): void {
    this.events.off('update-level', this.handleLevelUpdate, this);
    this.editorGrid?.destroy();
    this.editorGhost?.destroy();
    this.deleteHighlight?.destroy();
    this.selectionHighlight?.destroy();
    if (this.projectileManager) {
      this.projectileManager.destroy();
      this.projectileManager = undefined;
    }
  }
}
