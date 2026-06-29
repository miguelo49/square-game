import Phaser from 'phaser';
import type { AssetSchema, AssetAnimClip } from '../../types';
import { assetAnimKey, hasClipAnims, playSpriteAnim } from '../utils/textures';

type OneShotClip = AssetAnimClip;

export class AnimationController {
  private sprite: Phaser.Physics.Arcade.Sprite;
  private asset: AssetSchema | undefined;
  private onGroundFn: () => boolean;
  private currentClip: AssetAnimClip | null = null;
  private oneShotUntil = 0;
  private pendingOneShot: OneShotClip | null = null;

  constructor(
    sprite: Phaser.Physics.Arcade.Sprite,
    asset: AssetSchema | undefined,
    onGroundFn: () => boolean
  ) {
    this.sprite = sprite;
    this.asset = asset;
    this.onGroundFn = onGroundFn;
  }

  setAsset(asset: AssetSchema | undefined): void {
    this.asset = asset;
  }

  triggerOneShot(clip: AssetAnimClip): void {
    if (!this.asset || !hasClipAnims(this.asset)) return;
    const key = assetAnimKey(this.asset, clip);
    if (!key || !this.sprite.scene.anims.exists(key)) return;
    this.pendingOneShot = clip;
  }

  update(_time: number): void {
    if (!this.asset || !hasClipAnims(this.asset)) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body | null;
    const vx = body?.velocity.x ?? 0;
    const vy = body?.velocity.y ?? 0;
    const onGround = this.onGroundFn();

    if (this.sprite.flipX !== vx < 0 && Math.abs(vx) > 10) {
      this.sprite.setFlipX(vx < 0);
    }

    if (this.pendingOneShot) {
      const clip = this.pendingOneShot;
      this.pendingOneShot = null;
      this.playClip(clip, false);
      const anim = this.sprite.anims.currentAnim;
      const duration = anim ? (anim.frames.length / anim.frameRate) * 1000 : 300;
      this.oneShotUntil = _time + duration;
      return;
    }

    if (_time < this.oneShotUntil) return;

    let next: AssetAnimClip = 'idle';
    if (!onGround) {
      next = vy < -20 ? 'jump' : 'fall';
    } else if (Math.abs(vx) > 20) {
      next = 'walk';
    }

    if (next !== this.currentClip) {
      this.playClip(next, true);
    }
  }

  private playClip(clip: AssetAnimClip, allowFallback: boolean): void {
    const key = assetAnimKey(this.asset!, clip);
      if (key && this.sprite.scene.anims.exists(key)) {
        if (this.sprite.anims.currentAnim?.key !== key) {
          try {
            this.sprite.play(key, true);
            this.currentClip = clip;
          } catch {
            /* invalid anim frames — skip */
          }
        }
        return;
      }
    if (allowFallback && clip !== 'idle') {
      this.playClip('idle', false);
    }
  }
}

export function initSpriteAnimation(
  sprite: Phaser.Physics.Arcade.Sprite,
  asset: AssetSchema | undefined
): AnimationController | null {
  if (!asset || !hasClipAnims(asset)) {
    playSpriteAnim(sprite, asset, 'idle');
    return null;
  }
  const ctrl = new AnimationController(sprite, asset, () => {
    const body = sprite.body as Phaser.Physics.Arcade.Body | null;
    return body?.blocked.down ?? false;
  });
  ctrl.update(0);
  return ctrl;
}
