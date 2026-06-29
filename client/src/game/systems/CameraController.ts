import Phaser from 'phaser';

export class CameraController {
  private scene: Phaser.Scene;
  private mode: 'follow' | 'free' = 'follow';
  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private camStart = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupPanControls();
  }

  setMode(mode: 'follow' | 'free'): void {
    this.mode = mode;
    const cam = this.scene.cameras.main;
    if (mode === 'free') {
      cam.stopFollow();
      cam.setZoom(1);
    }
  }

  followTarget(target: Phaser.GameObjects.GameObject): void {
    if (this.mode === 'follow') {
      const cam = this.scene.cameras.main;
      cam.setZoom(1.5);
      cam.startFollow(target, true, 0.1, 0.1);
      cam.setDeadzone(60, 40);
    }
  }

  setBounds(width: number, height: number): void {
    this.scene.cameras.main.setBounds(0, 0, width, height);
  }

  private setupPanControls(): void {
    const cam = this.scene.cameras.main;

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        this.isPanning = true;
        this.panStart = { x: pointer.x, y: pointer.y };
        this.camStart = { x: cam.scrollX, y: cam.scrollY };
      }
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isPanning) return;
      const dx = (pointer.x - this.panStart.x) / cam.zoom;
      const dy = (pointer.y - this.panStart.y) / cam.zoom;
      cam.setScroll(this.camStart.x - dx, this.camStart.y - dy);
    });

    this.scene.input.on('pointerup', () => {
      this.isPanning = false;
    });

    this.scene.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: unknown[],
        _deltaX: number,
        deltaY: number
      ) => {
        if (this.mode !== 'free') return;
        const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.5, 2);
        cam.setZoom(newZoom);
      }
    );
  }

  panBy(dx: number, dy: number): void {
    const cam = this.scene.cameras.main;
    cam.scrollX += dx;
    cam.scrollY += dy;
  }
}
