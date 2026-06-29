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
      const img = this.scene.add.image(cell.localX, cell.localY, key);
      img.setDisplaySize(PLATFORM_TILE_SIZE, PLATFORM_TILE_SIZE);
      parent.add(img);
    }
  }

  refreshAll(
    platforms: PlatformDef[],
    containers: Map<string, Phaser.GameObjects.Container>
  ): void {
    const occupancy = buildOccupancyGrid(platforms);
    for (const def of platforms) {
      const container = containers.get(def.id);
      if (!container) continue;
      container.removeAll(true);
      const group = platformVisualGroup(def);
      ensurePlatformTileTextures(this.scene, group, this.assets);
      const cells = decomposePlatformTiles(def, occupancy);
      for (const cell of cells) {
        const key = autotileTextureKey(group, cell.variant);
        const img = this.scene.add.image(cell.localX, cell.localY, key);
        img.setDisplaySize(PLATFORM_TILE_SIZE, PLATFORM_TILE_SIZE);
        container.add(img);
      }
    }
  }
}
