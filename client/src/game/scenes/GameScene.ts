import Phaser from 'phaser';
import type { LevelSchema, SkillSchema, AssetSchema, GameMode, SelectedEnemyConfig, RunResult, PlatformDef } from '../../types';
import { CameraController } from '../systems/CameraController';
import { EditorGrid } from '../systems/EditorGrid';
import { EditorGhost } from '../systems/EditorGhost';
import { SkillInterpreter } from '../systems/SkillInterpreter';
import { TriangleEnemy } from '../entities/TriangleEnemy';
import { PlatformEntity } from '../entities/PlatformEntity';
import { PlatformTileRenderer } from '../systems/PlatformTileRenderer';
import { PlatformBehaviorRunner } from '../systems/PlatformBehaviorRunner';
import { createEnemy, presetToEnemyDef, DEFAULT_ENEMY_SELECTION } from '../entities/enemyRegistry';
import {
  createDefaultSquareTexture,
  createDefaultPlatformTexture,
  createDefaultEnemyTexture,
  createSpawnMarkerTexture,
  createPortalTexture,
  createProjectileTexture,
  registerAssetClips,
  registerPlatformAutotileSet,
  assetTextureKey,
} from '../utils/textures';
import { initSpriteAnimation, AnimationController } from '../systems/AnimationController';
import { ProjectileManager } from '../systems/ProjectileManager';
import { migrateLevel, snapToPlatformSurface, PORTAL_H } from '../utils/placement';
import { snapPlatformAdjacent } from '../utils/platformSnap';
import { applyPlatformPreset } from '../../data/platformPresets';
import { stripRuntimePlatforms } from '../systems/PlatformScriptRunner';
import { GAME_CAPTURE_KEYS } from '../utils/phaserKeys';
import { GRID_SNAP } from '../../data/retroLimits';
import { Sfx } from '../../audio/SfxPlayer';

export interface GameSceneCallbacks {
  onDeath?: () => void;
  onWin?: (result: RunResult) => void;
  onEditorSelect?: (type: string, id: string) => void;
  onCursorMove?: (x: number, y: number) => void;
  onCameraChange?: (x: number, y: number, zoom: number) => void;
}

type DraggableObject = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | TriangleEnemy;

type HitEntity = { type: 'enemy' | 'platform'; id: string };
type SelectedEntityType = 'enemy' | 'platform' | '';

export class GameScene extends Phaser.Scene {
  private level!: LevelSchema;
  private skills: SkillSchema[] = [];
  private assets: AssetSchema[] = [];
  private mode: GameMode = 'play';
  private player!: Phaser.Physics.Arcade.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private platformEntities: PlatformEntity[] = [];
  private platformTileRenderer?: PlatformTileRenderer;
  private platformBehaviorRunner?: PlatformBehaviorRunner;
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
  private deleteHighlight?: Phaser.GameObjects.Rectangle;
  private selectionHighlight?: Phaser.GameObjects.Rectangle;
  private selectedEntityId: string | null = null;
  private playerAnimCtrl?: AnimationController | null;
  private projectileManager?: ProjectileManager;
  private won = false;
  private runStartedAt = 0;
  private deathCount = 0;
  private defaultPlatformPreset = 'static';
  private showGridVisible = true;
  private coinsCollected = 0;
  private enemiesDefeated = 0;
  private lastCheckpoint: { x: number; y: number } | null = null;
  private coinSprites: Phaser.GameObjects.Arc[] = [];
  private checkpointMarkers: Phaser.GameObjects.Rectangle[] = [];
  private hazardZones: Phaser.Physics.Arcade.StaticGroup | undefined;
  private decorationSprites: Phaser.GameObjects.Image[] = [];
  private resizeHandles: Phaser.GameObjects.Rectangle[] = [];
  private dragStartX = 0;
  private dragStartY = 0;

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
    defaultPlatformPreset?: string;
    showGrid?: boolean;
  }): void {
    this.level = migrateLevel(data.level);
    this.skills = data.skills ?? [];
    this.assets = data.assets ?? [];
    this.mode = data.mode ?? 'play';
    this.callbacks = data.callbacks ?? {};
    this.editorTool = data.editorTool ?? 'select';
    this.selectedEnemy = data.selectedEnemy ?? DEFAULT_ENEMY_SELECTION;
    this.selectedEntityId = data.selectedEntityId ?? null;
    this.defaultPlatformPreset = data.defaultPlatformPreset ?? 'static';
    this.showGridVisible = data.showGrid ?? true;
    this.won = false;
    this.runStartedAt = Date.now();
    this.deathCount = 0;
    this.coinsCollected = 0;
    this.enemiesDefeated = 0;
    this.lastCheckpoint = null;
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
      if (asset.category === 'platform') {
        registerPlatformAutotileSet(this, asset);
      }
    }

    this.platformTileRenderer = new PlatformTileRenderer(this, this.assets);

    this.physics.world.setBounds(0, 0, this.level.width, this.level.height + 2000);
    this.cameras.main.setBackgroundColor(this.level.backgroundColor);

    this.cameraCtrl = new CameraController(this);
    this.cameraCtrl.setBounds(this.level.width, this.level.height);
    this.cameraCtrl.setMode(this.mode === 'play' ? 'follow' : 'free');

    if (this.mode === 'edit') {
      this.editorGrid = new EditorGrid(this, this.level.width, this.level.height);
      this.editorGrid.setVisible(this.showGridVisible);
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

    const playerAsset =
      (this.level.playerAssetId
        ? this.assets.find((a) => a.id === this.level.playerAssetId)
        : undefined) ?? this.assets.find((a) => a.category === 'player');
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
      if (this.mode === 'edit') {
        this.resizeHandles.forEach((h) => h.destroy());
        this.resizeHandles = [];
        if (id) this.buildResizeHandles();
      }
    }, this);
    this.events.on('set-grid-visible', (visible: boolean) => {
      this.showGridVisible = visible;
      this.editorGrid?.setVisible(visible);
    }, this);
  }

  private updateSelectionHighlight(): void {
    if (!this.selectionHighlight || this.mode !== 'edit') return;
    if (!this.selectedEntityId) {
      this.selectionHighlight.setVisible(false);
      return;
    }
    const enemy = this.level.enemies.find((en) => en.id === this.selectedEntityId);
    if (enemy) {
      this.selectionHighlight.setPosition(enemy.x, enemy.y);
      this.selectionHighlight.setSize(32, 32);
      this.selectionHighlight.setVisible(true);
      return;
    }
    const platform = this.level.platforms.find((pl) => pl.id === this.selectedEntityId);
    if (platform) {
      this.selectionHighlight.setPosition(platform.x + platform.w / 2, platform.y + platform.h / 2);
      this.selectionHighlight.setSize(platform.w, platform.h);
      this.selectionHighlight.setVisible(true);
      return;
    }
    this.selectionHighlight.setVisible(false);
  }

  private selectEntity(type: SelectedEntityType, id: string | null): void {
    this.selectedEntityId = id;
    this.updateSelectionHighlight();
    this.callbacks.onEditorSelect?.(type, id ?? '');
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

  private destroyPlatformEntities(): void {
    for (const e of this.platformEntities) {
      e.destroy();
    }
    this.platformEntities = [];
  }

  private createPlatformEntity(def: PlatformDef): PlatformEntity {
    const renderer = this.platformTileRenderer!;
    return new PlatformEntity(
      this,
      def,
      this.assets,
      renderer,
      this.level.platforms,
      this.platforms,
      this.mode === 'edit'
    );
  }

  private setupPlatformBehavior(): void {
    this.platformBehaviorRunner = new PlatformBehaviorRunner();
    this.platformBehaviorRunner.setEntities(this.platformEntities);
    this.platformBehaviorRunner.setSpawnCallback((def) => {
      const entity = this.createPlatformEntity(def);
      this.platformEntities.push(entity);
      this.platformBehaviorRunner!.addEntity(entity);
      if (this.enemyGroup) {
        this.physics.add.collider(this.enemyGroup, entity.bodySprite);
      }
      return entity;
    });
    this.platformBehaviorRunner.setDestroyCallback((entity) => {
      entity.destroy();
      this.platformEntities = this.platformEntities.filter((e) => e !== entity);
      this.platformBehaviorRunner?.removeEntity(entity);
    });
  }

  private buildLevel(): void {
    this.destroyPlatformEntities();
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
    this.coinSprites.forEach((s) => s.destroy());
    this.coinSprites = [];
    this.checkpointMarkers.forEach((s) => s.destroy());
    this.checkpointMarkers = [];
    this.decorationSprites.forEach((s) => s.destroy());
    this.decorationSprites = [];
    this.hazardZones?.destroy(true);
    this.hazardZones = undefined;
    this.resizeHandles.forEach((h) => h.destroy());
    this.resizeHandles = [];

    for (const p of this.level.platforms) {
      this.platformEntities.push(this.createPlatformEntity(p));
    }

    if (this.mode === 'play') {
      this.setupPlatformBehavior();
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
    this.buildExtras();
    if (this.mode === 'edit' && this.selectedEntityId) {
      this.buildResizeHandles();
    }
  }

  private buildExtras(): void {
    for (const c of this.level.coins ?? []) {
      const coin = this.add.circle(c.x, c.y, 8, 0xffdd00, 1);
      coin.setStrokeStyle(2, 0xaa8800);
      coin.setDepth(50);
      if (this.mode === 'edit') {
        coin.setInteractive({ draggable: true });
        coin.setData('type', 'coin');
        coin.setData('id', c.id);
      } else {
        this.physics.add.existing(coin);
        (coin.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        (coin.body as Phaser.Physics.Arcade.Body).setImmovable(true);
      }
      this.coinSprites.push(coin);
    }

    for (const cp of this.level.checkpoints ?? []) {
      const flag = this.add.rectangle(cp.x, cp.y, 24, 32, 0x44ff88, 0.7);
      flag.setStrokeStyle(2, 0x22aa44);
      flag.setDepth(50);
      if (this.mode === 'edit') {
        flag.setInteractive({ draggable: true });
        flag.setData('type', 'checkpoint');
        flag.setData('id', cp.id);
      } else {
        this.physics.add.existing(flag, true);
      }
      this.checkpointMarkers.push(flag);
    }

    for (const d of this.level.decorations ?? []) {
      const img = this.add.rectangle(d.x, d.y, d.w ?? 16, d.h ?? 16, 0x8888ff, 0.5);
      img.setDepth(10);
      if (this.mode === 'edit') {
        img.setInteractive({ draggable: true });
        img.setData('type', 'decoration');
        img.setData('id', d.id);
      }
      this.decorationSprites.push(img as unknown as Phaser.GameObjects.Image);
    }

    if ((this.level.hazards?.length ?? 0) > 0) {
      this.hazardZones = this.physics.add.staticGroup();
      for (const h of this.level.hazards ?? []) {
        const zone = this.add.rectangle(
          h.x + h.w / 2,
          h.y + h.h / 2,
          h.w,
          h.h,
          h.type === 'lava' ? 0xff4400 : 0xff0000,
          0.6
        );
        if (this.mode === 'edit') {
          zone.setInteractive({ draggable: true });
          zone.setData('type', 'hazard');
          zone.setData('id', h.id);
        } else {
          this.hazardZones.add(zone);
          this.physics.add.existing(zone, true);
          (zone.body as Phaser.Physics.Arcade.StaticBody).setSize(h.w, h.h);
          this.physics.add.overlap(this.player, zone, () => this.handleDeath());
        }
      }
    }
  }

  private buildResizeHandles(): void {
    const platform = this.level.platforms.find((p) => p.id === this.selectedEntityId);
    if (!platform) return;
    const right = this.add.rectangle(
      platform.x + platform.w,
      platform.y + platform.h / 2,
      8,
      16,
      0xffff00,
      0.8
    );
    right.setInteractive({ draggable: true });
    right.setData('type', 'resize-r');
    right.setData('platformId', platform.id);
    right.setDepth(1001);
    this.resizeHandles.push(right);
  }

  private checkWinCondition(): void {
    const wc = this.level.winCondition ?? { type: 'portal' as const };
    if (wc.type === 'coins') {
      if (this.coinsCollected >= (wc.target ?? 1)) this.handleWin();
    } else if (wc.type === 'enemies') {
      if (this.enemiesDefeated >= (wc.target ?? 1)) this.handleWin();
    }
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
    this.setupCollectiblePhysics();
  }

  private setupCollectiblePhysics(): void {
    for (const coin of this.coinSprites) {
      if (!coin.active) continue;
      this.physics.add.overlap(this.player, coin, () => {
        if (!coin.active) return;
        coin.destroy();
        this.coinsCollected++;
        Sfx.coin();
        this.checkWinCondition();
      });
    }
    for (const flag of this.checkpointMarkers) {
      this.physics.add.overlap(this.player, flag, () => {
        this.lastCheckpoint = { x: flag.x, y: flag.y };
      });
    }
  }

  private setupPortalOverlap(): void {
    if (this.portalZone) {
      this.physics.add.overlap(this.player, this.portalZone, () => {
        const wc = this.level.winCondition ?? { type: 'portal' as const };
        if (wc.type === 'portal') {
          Sfx.portal();
          this.handleWin();
        }
      });
    }
  }

  private setupEditorInput(): void {
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('dragstart');
    this.input.off('dragstart');
    this.input.off('drag');
    this.input.off('dragend');

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.callbacks.onCursorMove?.(world.x, world.y);

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
          this.selectEntity('enemy', hit.id);
        } else if (hit?.type === 'platform') {
          this.selectEntity('platform', hit.id);
        } else {
          this.selectEntity('', null);
        }
        return;
      }

      const x = Math.round(world.x / GRID_SNAP) * GRID_SNAP;
      const y = Math.round(world.y / GRID_SNAP) * GRID_SNAP;

      if (this.editorTool === 'platform') {
        const id = `p-${Date.now()}`;
        let newPlat: PlatformDef = {
          id,
          x: 0,
          y: 0,
          w: 128,
          h: 32,
          solid: true,
          presetId: this.defaultPlatformPreset,
          assetId: this.level.defaultPlatformAssetId,
        };
        const snapped = snapPlatformAdjacent({ ...newPlat, x, y }, this.level.platforms);
        newPlat.x = snapped.x;
        newPlat.y = snapped.y;
        newPlat = applyPlatformPreset(newPlat, this.defaultPlatformPreset);
        this.level.platforms.push(newPlat);
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
      } else if (this.editorTool === 'coin') {
        this.level.coins = [
          ...(this.level.coins ?? []),
          { id: `c-${Date.now()}`, x, y },
        ];
        this.rebuildAndEmit();
      } else if (this.editorTool === 'checkpoint') {
        const pos = snapToPlatformSurface(x, y, this.level.platforms);
        this.level.checkpoints = [
          ...(this.level.checkpoints ?? []),
          { id: `cp-${Date.now()}`, x: pos.x, y: pos.y },
        ];
        this.rebuildAndEmit();
      } else if (this.editorTool === 'decoration') {
        this.level.decorations = [
          ...(this.level.decorations ?? []),
          { id: `d-${Date.now()}`, x, y, w: 16, h: 16 },
        ];
        this.rebuildAndEmit();
      } else if (this.editorTool === 'hazard') {
        this.level.hazards = [
          ...(this.level.hazards ?? []),
          { id: `h-${Date.now()}`, x: x - 16, y: y - 8, w: 32, h: 16, type: 'spike' },
        ];
        this.rebuildAndEmit();
      }
    });

    this.input.on('dragstart', (pointer: Phaser.Input.Pointer) => {
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
    });

    this.input.on('drag', (
      _pointer: Phaser.Input.Pointer,
      gameObject: Phaser.GameObjects.GameObject,
      dragX: number,
      dragY: number
    ) => {
      const type = gameObject.getData('type') as string;
      const id = gameObject.getData('id') as string;
      const snapX = Math.round(dragX / GRID_SNAP) * GRID_SNAP;
      const snapY = Math.round(dragY / GRID_SNAP) * GRID_SNAP;

      if (type === 'resize-r') {
        const pid = gameObject.getData('platformId') as string;
        const p = this.level.platforms.find((pl) => pl.id === pid);
        if (p) {
          p.w = Math.max(32, Math.round((snapX - p.x) / GRID_SNAP) * GRID_SNAP);
        }
        return;
      }

      if (type === 'platform') {
        const entity = this.platformEntities.find((pe) => pe.id === id);
        const p = this.level.platforms.find((pl) => pl.id === id);
        if (entity && p) {
          let nx = snapX - p.w / 2;
          let ny = snapY - p.h / 2;
          const snapped = snapPlatformAdjacent({ ...p, x: nx, y: ny }, this.level.platforms);
          nx = snapped.x;
          ny = snapped.y;
          entity.setPosition(nx, ny);
          (gameObject as Phaser.GameObjects.Rectangle).x = p.w / 2;
          (gameObject as Phaser.GameObjects.Rectangle).y = p.h / 2;
        }
        return;
      }

      const go = gameObject as DraggableObject;
      go.x = snapX;
      go.y = snapY;
    });

    this.input.on('dragend', (
      pointer: Phaser.Input.Pointer,
      gameObject: Phaser.GameObjects.GameObject
    ) => {
      const type = gameObject.getData('type') as string;
      const id = gameObject.getData('id') as string;
      const go = gameObject as DraggableObject;
      let x = go.x;
      let y = go.y;

      if (type === 'platform') {
        const moved =
          Math.hypot(pointer.x - this.dragStartX, pointer.y - this.dragStartY) > 4;
        if (!moved) return;

        const entity = this.platformEntities.find((pe) => pe.id === id);
        const p = this.level.platforms.find((pl) => pl.id === id);
        if (entity && p) {
          p.x = entity.baseX;
          p.y = entity.baseY;
          const snapped = snapPlatformAdjacent(p, this.level.platforms);
          p.x = snapped.x;
          p.y = snapped.y;
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
      } else if (type === 'coin') {
        const c = this.level.coins?.find((coin) => coin.id === id);
        if (c) {
          c.x = x;
          c.y = y;
        }
      } else if (type === 'checkpoint') {
        const snapped = snapToPlatformSurface(x, y, this.level.platforms);
        const cp = this.level.checkpoints?.find((c) => c.id === id);
        if (cp) {
          cp.x = snapped.x;
          cp.y = snapped.y;
        }
      } else if (type === 'decoration') {
        const d = this.level.decorations?.find((dec) => dec.id === id);
        if (d) {
          d.x = x;
          d.y = y;
        }
      } else if (type === 'resize-r') {
        return;
      }

      this.rebuildAndEmit();
    });

    const draggables = [
      ...this.platformEntities
        .map((pe) => pe.getDraggable())
        .filter(Boolean),
      ...this.editorEnemySprites,
      ...this.coinSprites,
      ...this.checkpointMarkers,
      ...this.decorationSprites,
      ...this.resizeHandles,
      this.spawnMarker,
      this.portalMarker,
    ].filter(Boolean) as Phaser.GameObjects.GameObject[];

    this.input.setDraggable(draggables);
  }

  private rebuildAndEmit(): void {
    this.level.platforms = stripRuntimePlatforms(this.level);
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
    Sfx.hurt();
    this.playerAnimCtrl?.triggerOneShot('hurt');
    const respawn = this.lastCheckpoint ?? this.level.spawn;
    this.player.setPosition(respawn.x, respawn.y);
    this.player.setVelocity(0, 0);
    this.callbacks.onDeath?.();
  }

  private handleWin(): void {
    if (this.won) return;
    const wc = this.level.winCondition ?? { type: 'portal' as const };
    if (wc.type !== 'portal' && wc.type !== 'coins' && wc.type !== 'enemies') {
      /* survive handled in update */
    }
    this.won = true;
    this.player.setVelocity(0, 0);
    Sfx.win();
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
      this.platformBehaviorRunner?.update(delta, this.player, this.cameras.main);
      for (const enemy of this.enemies) {
        enemy.update(this.player, delta, _time);
      }

      const DEATH_MARGIN = 32;
      if (this.player.y + 16 > this.level.height + DEATH_MARGIN) {
        this.handleDeath();
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
      const cam = this.cameras.main;
      this.callbacks.onCameraChange?.(cam.scrollX, cam.scrollY, cam.zoom);
    }

    if (this.mode === 'play' && !this.won) {
      const wc = this.level.winCondition;
      if (wc?.type === 'survive' && wc.target) {
        const elapsed = (Date.now() - this.runStartedAt) / 1000;
        if (elapsed >= wc.target) this.handleWin();
      }
    }
  }

  getLevel(): LevelSchema {
    return this.level;
  }

  shutdown(): void {
    this.events.off('update-level', this.handleLevelUpdate, this);
    this.destroyPlatformEntities();
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
