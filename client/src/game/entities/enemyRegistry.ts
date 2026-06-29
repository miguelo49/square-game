import Phaser from 'phaser';
import type { EnemyDef, EnemyBehavior, SelectedEnemyConfig } from '../../types';
import { TriangleEnemy } from './TriangleEnemy';

export interface EnemyPreset {
  typeId: string;
  label: string;
  behavior: EnemyBehavior;
  patrolRange?: number;
}

export const ENEMY_PRESETS: EnemyPreset[] = [
  { typeId: 'triangle_patrol', label: '△ Patrulla', behavior: 'patrol', patrolRange: 128 },
  { typeId: 'triangle_chase', label: '△ Persigue', behavior: 'chase', patrolRange: 128 },
  { typeId: 'triangle_stationary', label: '△ Quieto', behavior: 'stationary' },
  { typeId: 'hopper', label: '△ Saltarín', behavior: 'hopper', patrolRange: 64 },
];

export const DEFAULT_ENEMY_SELECTION: SelectedEnemyConfig = {
  typeId: 'triangle_patrol',
  behavior: 'patrol',
  patrolRange: 128,
};

export function presetToEnemyDef(
  pos: { x: number; y: number },
  id: string,
  selected: SelectedEnemyConfig
): EnemyDef {
  return {
    id,
    x: pos.x,
    y: pos.y,
    behavior: selected.behavior,
    patrolRange: selected.patrolRange ?? 128,
    assetId: selected.assetId,
    typeId: selected.typeId,
  };
}

export function createEnemy(scene: Phaser.Scene, def: EnemyDef): TriangleEnemy {
  return new TriangleEnemy(scene, def);
}
