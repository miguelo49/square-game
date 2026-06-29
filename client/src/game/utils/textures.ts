import Phaser from 'phaser';
import type { AssetSchema } from '../../types';
import { paletteColor } from '../../data/snesPalette';

export function getAssetFrames(asset: AssetSchema): number[][] {
  if (asset.frames && asset.frames.length > 0) return asset.frames;
  return [asset.pixels];
}

function drawFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  pixels: number[],
  w: number,
  h: number,
  paletteSlots: number[],
  offsetX = 0,
  offsetY = 0
): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = pixels[y * w + x] ?? 0;
      if (idx === 0) continue;
      const masterIdx = paletteSlots[idx] ?? idx;
      ctx.fillStyle = paletteColor(masterIdx);
      ctx.fillRect(offsetX + x, offsetY + y, 1, 1);
    }
  }
}

export function registerAsset(scene: Phaser.Scene, asset: AssetSchema): void {
  const baseKey = `asset-${asset.id}`;
  const frames = getAssetFrames(asset);
  const w = asset.width;
  const h = asset.height;

  if (frames.length === 1) {
    if (scene.textures.exists(baseKey)) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    drawFrameToCanvas(ctx, frames[0]!, w, h, asset.paletteSlots);
    scene.textures.addCanvas(baseKey, canvas);
    return;
  }

  const sheetKey = `${baseKey}-sheet`;
  const animKey = `${baseKey}-anim`;
  if (scene.textures.exists(sheetKey)) return;

  const canvas = document.createElement('canvas');
  canvas.width = w * frames.length;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  frames.forEach((frame, i) => {
    drawFrameToCanvas(ctx, frame, w, h, asset.paletteSlots, i * w, 0);
  });
  scene.textures.addCanvas(sheetKey, canvas);
  const texture = scene.textures.get(sheetKey);
  for (let i = 0; i < frames.length; i++) {
    texture.add(i, 0, i * w, 0, w, h);
  }

  if (!scene.anims.exists(animKey)) {
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(sheetKey, {
        start: 0,
        end: frames.length - 1,
      }),
      frameRate: asset.fps ?? 8,
      repeat: -1,
    });
  }
}

/** @deprecated use registerAsset */
export function assetToTexture(
  scene: Phaser.Scene,
  asset: AssetSchema,
  textureKey: string
): void {
  void textureKey;
  registerAsset(scene, asset);
}

export function assetTextureKey(asset: AssetSchema): string {
  const frames = getAssetFrames(asset);
  if (frames.length > 1) return `asset-${asset.id}-sheet`;
  return `asset-${asset.id}`;
}

export function assetAnimKey(asset: AssetSchema): string | null {
  const frames = getAssetFrames(asset);
  if (frames.length <= 1) return null;
  return `asset-${asset.id}-anim`;
}

export function createDefaultSquareTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('square-default')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x00d4ff);
  g.fillRect(0, 0, 32, 32);
  g.fillStyle(0x0099cc);
  g.fillRect(4, 4, 24, 24);
  g.fillStyle(0xffffff);
  g.fillRect(10, 10, 6, 6);
  g.fillRect(18, 10, 6, 6);
  g.generateTexture('square-default', 32, 32);
  g.destroy();
}

export function createDefaultPlatformTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('platform-default')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x8b4513);
  g.fillRect(0, 0, 16, 16);
  g.fillStyle(0x228b22);
  g.fillRect(0, 0, 16, 4);
  g.generateTexture('platform-default', 16, 16);
  g.destroy();
}

export function createDefaultEnemyTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('enemy-default')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0xff3333);
  g.fillTriangle(16, 0, 0, 32, 32, 32);
  g.fillStyle(0xffffff);
  g.fillRect(10, 14, 4, 4);
  g.fillRect(18, 14, 4, 4);
  g.generateTexture('enemy-default', 32, 32);
  g.destroy();
}

export function createSpawnMarkerTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('spawn-marker')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.lineStyle(2, 0xffff00);
  g.strokeRect(0, 0, 32, 32);
  g.fillStyle(0xffff00, 0.3);
  g.fillRect(8, 8, 16, 16);
  g.generateTexture('spawn-marker', 32, 32);
  g.destroy();
}

export function createPortalTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('portal-default')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x4a0080, 0.6);
  g.fillEllipse(16, 28, 28, 40);
  g.lineStyle(3, 0xaa44ff);
  g.strokeEllipse(16, 28, 24, 36);
  g.fillStyle(0x00ffff, 0.8);
  g.fillEllipse(16, 30, 12, 20);
  g.fillStyle(0xffffff, 0.9);
  g.fillEllipse(16, 32, 6, 10);
  g.generateTexture('portal-default', 32, 48);
  g.destroy();
}

export function playSpriteAnim(
  sprite: Phaser.GameObjects.Sprite,
  asset: AssetSchema | undefined
): void {
  if (!asset) return;
  const animKey = assetAnimKey(asset);
  if (animKey && sprite.scene.anims.exists(animKey)) {
    sprite.play(animKey);
  }
}
