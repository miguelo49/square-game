import Phaser from 'phaser';
import { GRID_SNAP } from '../../data/retroLimits';

export class EditorGrid {
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(-100);
    this.graphics.setScrollFactor(1);
    this.draw(width, height);
  }

  private draw(width: number, height: number): void {
    this.graphics.clear();

    for (let x = 0; x <= width; x += GRID_SNAP) {
      const major = x % 32 === 0;
      this.graphics.lineStyle(1, 0xffffff, major ? 0.2 : 0.08);
      this.graphics.beginPath();
      this.graphics.moveTo(x, 0);
      this.graphics.lineTo(x, height);
      this.graphics.strokePath();
    }

    for (let y = 0; y <= height; y += GRID_SNAP) {
      const major = y % 32 === 0;
      this.graphics.lineStyle(1, 0xffffff, major ? 0.2 : 0.08);
      this.graphics.beginPath();
      this.graphics.moveTo(0, y);
      this.graphics.lineTo(width, y);
      this.graphics.strokePath();
    }
  }

  resize(width: number, height: number): void {
    this.draw(width, height);
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
