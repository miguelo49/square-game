import type { AssetSchema, AssetAnimClip, AssetClipDef } from '../../types';
import { ASSET_ANIM_CLIPS } from '../../types';

const DEFAULT_LOOP: Record<AssetAnimClip, boolean> = {
  idle: true,
  walk: true,
  jump: false,
  fall: false,
  shoot: false,
  hurt: false,
};

export function migrateAssetAnimations(asset: AssetSchema): Partial<Record<AssetAnimClip, AssetClipDef>> {
  const anims = { ...(asset.animations ?? {}) };
  if (!anims.idle && asset.frames?.length) {
    anims.idle = {
      frames: asset.frames.map((f) => [...f]),
      fps: asset.fps ?? 8,
      loop: true,
    };
  }
  if (!anims.idle && asset.pixels?.some((p) => p !== 0)) {
    anims.idle = {
      frames: [[...asset.pixels]],
      fps: 8,
      loop: true,
    };
  }
  return anims;
}

export function getClipFrames(
  asset: AssetSchema,
  clip: AssetAnimClip
): number[][] | null {
  const anims = migrateAssetAnimations(asset);
  const def = anims[clip];
  if (!def?.frames?.length) return null;
  return def.frames;
}

export function getPrimaryClip(asset: AssetSchema): AssetAnimClip | null {
  const anims = migrateAssetAnimations(asset);
  for (const clip of ASSET_ANIM_CLIPS) {
    if (anims[clip]?.frames?.length) return clip;
  }
  return null;
}

export function clipAnimKey(assetId: string, clip: AssetAnimClip): string {
  return `asset-${assetId}-${clip}-anim`;
}

export function clipSheetKey(assetId: string, clip: AssetAnimClip): string {
  return `asset-${assetId}-${clip}-sheet`;
}

export function clipLoopsByDefault(clip: AssetAnimClip): boolean {
  return DEFAULT_LOOP[clip];
}

export function emptyClip(): AssetClipDef {
  return { frames: [new Array(32 * 32).fill(0)], fps: 8, loop: true };
}
