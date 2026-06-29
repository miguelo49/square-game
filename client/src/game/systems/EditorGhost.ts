import Phaser from 'phaser';
import { GRID_SNAP } from '../../data/retroLimits';
import { TRON_PLATFORM_COLORS } from '../utils/textures';

const DEFAULT_W = 128;
const DEFAULT_H = 32;

export class EditorGhost {
  private rect: Phaser.GameObjects.Rectangle;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.rect = scene.add.rectangle(0, 0, DEFAULT_W, DEFAULT_H, TRON_PLATFORM_COLORS.base, 0.4);
    this.rect.setStrokeStyle(2, TRON_PLATFORM_COLORS.neon, 0.8);
    this.rect.setDepth(500);
    this.rect.setScrollFactor(1);
    this.rect.setVisible(false);
  }

  showTopLeft(x: number, y: number): void {
    const sx = Math.round(x / GRID_SNAP) * GRID_SNAP;
    const sy = Math.round(y / GRID_SNAP) * GRID_SNAP;
    this.rect.setPosition(sx + DEFAULT_W / 2, sy + DEFAULT_H / 2);
    this.rect.setVisible(true);
    this.visible = true;
  }

  hide(): void {
    this.rect.setVisible(false);
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.rect.destroy();
  }
}
