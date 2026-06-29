import Phaser from 'phaser';
import type { AssetSchema } from '../../types';
import { assetTextureKey, createProjectileTexture } from '../utils/textures';
import type { TriangleEnemy } from '../entities/TriangleEnemy';

interface Projectile {
  sprite: Phaser.Physics.Arcade.Sprite;
  life: number;
}

export class ProjectileManager {
  private scene: Phaser.Scene;
  private group: Phaser.Physics.Arcade.Group;
  private projectiles: Projectile[] = [];
  private assets: AssetSchema[] = [];
  private enemies: TriangleEnemy[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    createProjectileTexture(scene);
    this.group = scene.physics.add.group();
  }

  setAssets(assets: AssetSchema[]): void {
    this.assets = assets;
  }

  setupColliders(
    platforms: Phaser.Physics.Arcade.StaticGroup,
    enemies: TriangleEnemy[]
  ): void {
    this.enemies = enemies;
    this.scene.physics.add.collider(this.group, platforms, (obj) => {
      this.destroyProjectile(obj as Phaser.Physics.Arcade.Sprite);
    });
    for (const enemy of enemies) {
      this.scene.physics.add.overlap(this.group, enemy, (_p, e) => {
        (e as TriangleEnemy).destroy();
        this.enemies = this.enemies.filter((en) => en !== e);
      });
    }
  }

  fire(
    x: number,
    y: number,
    direction: number,
    assetId: string | undefined,
    speed = 400,
    lifeMs = 2000
  ): void {
    let tex = 'projectile-default';
    if (assetId) {
      const asset = this.assets.find((a) => a.id === assetId);
      if (asset) {
        const key = assetTextureKey(asset, 'idle');
        if (this.scene.textures.exists(key)) tex = key;
      } else if (this.scene.textures.exists(`asset-${assetId}`)) {
        tex = `asset-${assetId}`;
      }
    }

    const sprite = this.group.create(x, y, tex) as Phaser.Physics.Arcade.Sprite;
    sprite.setDisplaySize(16, 16);
    (sprite.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    sprite.setVelocityX(direction * speed);
    sprite.setVelocityY(0);
    this.projectiles.push({ sprite, life: lifeMs });
  }

  private destroyProjectile(sprite: Phaser.Physics.Arcade.Sprite): void {
    const idx = this.projectiles.findIndex((p) => p.sprite === sprite);
    if (idx >= 0) this.projectiles.splice(idx, 1);
    sprite.destroy();
  }

  update(delta: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      p.life -= delta;
      if (p.life <= 0) {
        p.sprite.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  destroy(): void {
    for (const p of this.projectiles) {
      if (p.sprite?.active) p.sprite.destroy();
    }
    this.projectiles = [];
    if (!this.group) return;
    try {
      this.group.clear(true, true);
      this.group.destroy(true);
    } catch {
      /* group already torn down with scene restart */
    }
  }
}
