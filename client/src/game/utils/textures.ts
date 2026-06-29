import Phaser from 'phaser';
import type { AssetSchema, AssetAnimClip } from '../../types';
import { ASSET_ANIM_CLIPS } from '../../types';
import { paletteColor } from '../../data/snesPalette';
import {
  migrateAssetAnimations,
  clipAnimKey,
  clipSheetKey,
  getClipFrames,
  getPrimaryClip,
} from './assetAnimations';

export function getAssetFrames(asset: AssetSchema): number[][] {
  const idle = getClipFrames(asset, 'idle');
  if (idle) return idle;
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

function registerClipSheet(
  scene: Phaser.Scene,
  asset: AssetSchema,
  clip: AssetAnimClip,
  frames: number[][]
): void {
  const w = asset.width;
  const h = asset.height;
  const sheetKey = clipSheetKey(asset.id, clip);
  const animKey = clipAnimKey(asset.id, clip);
  if (scene.textures.exists(sheetKey)) return;

  const anims = migrateAssetAnimations(asset);
  const def = anims[clip];
  const loop = def?.loop ?? (clip === 'idle' || clip === 'walk');

  if (frames.length === 1) {
    const baseKey = `asset-${asset.id}-${clip}`;
    if (scene.textures.exists(baseKey)) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    drawFrameToCanvas(ctx, frames[0]!, w, h, asset.paletteSlots);
    scene.textures.addCanvas(baseKey, canvas);
    return;
  }

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
      frameRate: def?.fps ?? asset.fps ?? 8,
      repeat: loop ? -1 : 0,
    });
  }
}

export function registerAssetClips(scene: Phaser.Scene, asset: AssetSchema): void {
  const anims = migrateAssetAnimations(asset);
  let registered = false;
  for (const clip of ASSET_ANIM_CLIPS) {
    const frames = anims[clip]?.frames;
    if (!frames?.length) continue;
    registerClipSheet(scene, asset, clip, frames);
    registered = true;
  }
  if (!registered) {
    registerLegacyAsset(scene, asset);
  }
}

function registerLegacyAsset(scene: Phaser.Scene, asset: AssetSchema): void {
  const baseKey = `asset-${asset.id}`;
  const frames = asset.frames?.length ? asset.frames : [asset.pixels];
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

  registerClipSheet(scene, asset, 'idle', frames);
  const animKey = `asset-${asset.id}-anim`;
  const sheetKey = clipSheetKey(asset.id, 'idle');
  if (!scene.anims.exists(animKey) && scene.textures.exists(sheetKey)) {
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

/** @deprecated use registerAssetClips */
export function registerAsset(scene: Phaser.Scene, asset: AssetSchema): void {
  registerAssetClips(scene, asset);
}

export function assetToTexture(
  scene: Phaser.Scene,
  asset: AssetSchema,
  textureKey: string
): void {
  void textureKey;
  registerAssetClips(scene, asset);
}

export function assetTextureKey(asset: AssetSchema, clip: AssetAnimClip = 'idle'): string {
  const frames = getClipFrames(asset, clip) ?? getAssetFrames(asset);
  if (frames.length > 1) return clipSheetKey(asset.id, clip);
  const anims = migrateAssetAnimations(asset);
  if (anims[clip]?.frames?.length === 1) return `asset-${asset.id}-${clip}`;
  if (frames.length === 1 && getPrimaryClip(asset) === clip) {
    return `asset-${asset.id}-${clip}`;
  }
  return `asset-${asset.id}`;
}

export function assetAnimKey(asset: AssetSchema, clip: AssetAnimClip = 'idle'): string | null {
  const frames = getClipFrames(asset, clip);
  if (!frames || frames.length <= 1) return null;
  return clipAnimKey(asset.id, clip);
}

export function hasClipAnims(asset: AssetSchema): boolean {
  const anims = migrateAssetAnimations(asset);
  return ASSET_ANIM_CLIPS.some((c) => (anims[c]?.frames?.length ?? 0) > 0);
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

export function createProjectileTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('projectile-default')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffff00);
  g.fillCircle(8, 8, 6);
  g.generateTexture('projectile-default', 16, 16);
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
  asset: AssetSchema | undefined,
  clip: AssetAnimClip = 'idle'
): void {
  if (!asset) return;
  const animKey = assetAnimKey(asset, clip) ?? (clip === 'idle' ? `asset-${asset.id}-anim` : null);
  if (animKey && sprite.scene.anims.exists(animKey)) {
    sprite.play(animKey);
  }
}
