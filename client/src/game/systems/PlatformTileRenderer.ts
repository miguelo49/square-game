import Phaser from 'phaser';
import type { AssetSchema, PlatformDef } from '../../types';
import {
  autotileTextureKey,
  buildOccupancyGrid,
  decomposePlatformTiles,
  platformVisualGroup,
  PLATFORM_TILE_SIZE,
} from '../utils/platformAutotile';
import { ensurePlatformTileTextures } from '../utils/textures';

export class PlatformTileRenderer {
  private scene: Phaser.Scene;
  private assets: AssetSchema[];

  constructor(scene: Phaser.Scene, assets: AssetSchema[]) {
    this.scene = scene;
    this.assets = assets;
  }

  setAssets(assets: AssetSchema[]): void {
    this.assets = assets;
  }

  /** Create tile image as container child only — never add to scene root first. */
  private createTileImage(localX: number, localY: number, key: string): Phaser.GameObjects.Image {
    const img = this.scene.make.image({
      x: localX,
      y: localY,
      key,
      add: false,
    });
    img.setDisplaySize(PLATFORM_TILE_SIZE, PLATFORM_TILE_SIZE);
    return img;
  }

  buildVisual(
    def: PlatformDef,
    allPlatforms: PlatformDef[],
    parent: Phaser.GameObjects.Container
  ): void {
    parent.removeAll(true);
    const group = platformVisualGroup(def);
    ensurePlatformTileTextures(this.scene, group, this.assets);

    const occupancy = buildOccupancyGrid(allPlatforms);
    const cells = decomposePlatformTiles(def, occupancy);

    for (const cell of cells) {
      const key = autotileTextureKey(group, cell.variant);
      parent.add(this.createTileImage(cell.localX, cell.localY, key));
    }
  }

  refreshAll(
    platforms: PlatformDef[],
    containers: Map<string, Phaser.GameObjects.Container>,
    editMode = false
  ): void {
    const occupancy = buildOccupancyGrid(platforms);
    for (const def of platforms) {
      const container = containers.get(def.id);
      if (!container) continue;

      const preserved = editMode
        ? container.list.filter((c) => c.getData?.('type') === 'platform')
        : [];
      for (const child of container.list) {
        if (!preserved.includes(child)) child.destroy();
      }
      container.removeAll(false);

      const group = platformVisualGroup(def);
      ensurePlatformTileTextures(this.scene, group, this.assets);
      const cells = decomposePlatformTiles(def, occupancy);
      for (const cell of cells) {
        const key = autotileTextureKey(group, cell.variant);
        container.add(this.createTileImage(cell.localX, cell.localY, key));
      }
      for (const p of preserved) container.add(p);
    }
  }
}
