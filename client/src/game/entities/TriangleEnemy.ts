import Phaser from 'phaser';
import type { EnemyDef, AssetSchema } from '../../types';
import { assetTextureKey } from '../utils/textures';
import { initSpriteAnimation, AnimationController } from '../systems/AnimationController';

export class TriangleEnemy extends Phaser.Physics.Arcade.Sprite {
  private behavior: EnemyDef['behavior'];
  private patrolRange: number;
  private startX: number;
  private direction = 1;
  private chaseRange = 320;
  private hopTimer = 0;
  private hopInterval = 1200;
  private moveSpeed = 80;
  private animCtrl?: AnimationController | null;

  constructor(scene: Phaser.Scene, def: EnemyDef, assets: AssetSchema[] = []) {
    const asset = def.assetId ? assets.find((a) => a.id === def.assetId) : undefined;
    const baseKey = def.assetId ? `asset-${def.assetId}` : 'enemy-default';
    let tex = baseKey;
    if (asset) {
      tex = assetTextureKey(asset, 'idle');
      if (!scene.textures.exists(tex)) tex = baseKey;
    } else if (def.assetId) {
      const idleSheet = `asset-${def.assetId}-idle-sheet`;
      if (scene.textures.exists(idleSheet)) tex = idleSheet;
    }
    super(scene, def.x, def.y, tex);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDisplaySize(32, 32);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(28, 28);
    body.setOffset(2, 2);
    body.setAllowGravity(true);
    body.setGravityY(900);
    body.setImmovable(false);
    body.setCollideWorldBounds(false);

    this.behavior = def.behavior;
    this.patrolRange = def.patrolRange ?? 128;
    this.startX = def.x;
    this.direction = def.direction ?? 1;
    this.moveSpeed = def.speed ?? 80;

    this.animCtrl = initSpriteAnimation(this, asset);
    if (!this.animCtrl) {
      const legacy = def.assetId ? `asset-${def.assetId}-anim` : null;
      if (legacy && scene.anims.exists(legacy)) this.play(legacy);
    }
  }

  update(player?: Phaser.Physics.Arcade.Sprite, delta = 16, time = 0): void {
    switch (this.behavior) {
      case 'patrol':
        this.patrol();
        break;
      case 'chase':
        if (player) this.chase(player);
        else this.patrol();
        break;
      case 'stationary':
        this.setVelocityX(0);
        break;
      case 'hopper':
        this.hopTimer += delta;
        if (this.hopTimer >= this.hopInterval && this.body?.blocked.down) {
          this.setVelocityY(-280);
          this.hopTimer = 0;
        }
        this.patrol();
        break;
    }
    this.animCtrl?.update(time);
  }

  private patrol(): void {
    const dist = this.x - this.startX;
    if (dist > this.patrolRange) this.direction = -1;
    if (dist < -this.patrolRange) this.direction = 1;
    const speed = this.behavior === 'hopper' ? Math.min(this.moveSpeed, 80) : this.moveSpeed;
    this.setVelocityX(this.direction * speed);
    this.setFlipX(this.direction < 0);
  }

  private chase(player: Phaser.Physics.Arcade.Sprite): void {
    const dx = player.x - this.x;
    if (Math.abs(dx) > this.chaseRange) {
      this.patrol();
      return;
    }
    this.direction = dx > 0 ? 1 : -1;
    this.setVelocityX(this.direction * 140);
    this.setFlipX(this.direction < 0);
  }
}
