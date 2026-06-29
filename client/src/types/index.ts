export type AssetCategory = 'player' | 'platform' | 'enemy';
export type EnemyBehavior = 'patrol' | 'chase' | 'stationary' | 'hopper';
export type SkillTriggerType = 'keydown' | 'keyup' | 'hold';
export type SkillConditionType = 'onGround' | 'inAir' | 'cooldownReady';
export type SkillActionType = 'jump' | 'move' | 'dash' | 'gravity';

export interface PlatformDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  solid: boolean;
  assetId?: string;
}

export interface EnemyDef {
  id: string;
  x: number;
  y: number;
  behavior: EnemyBehavior;
  patrolRange?: number;
  assetId?: string;
  typeId?: string;
}

export interface PortalDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MusicNote {
  voice: number;
  pitch: number;
  startBeat: number;
  duration: number;
  wave: 'square' | 'triangle';
}

export interface MusicSchema {
  bpm: number;
  bars: number;
  notes: MusicNote[];
}

export interface LevelSchema {
  version: number;
  name: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  portal: PortalDef;
  backgroundColor: string;
  platforms: PlatformDef[];
  enemies: EnemyDef[];
  skills: string[];
  musicSeed?: number;
  music?: MusicSchema;
}

export interface SkillTrigger {
  type: SkillTriggerType;
  key: string;
}

export interface SkillAction {
  type: SkillActionType;
  force?: number;
  axis?: 'x' | 'y';
  speed?: number;
  distance?: number;
  cooldown?: number;
  multiplier?: number;
}

export interface SkillCondition {
  type: SkillConditionType;
}

export interface SkillSchema {
  id: string;
  name: string;
  trigger: SkillTrigger;
  actions: SkillAction[];
  conditions?: SkillCondition[];
}

export interface AssetSchema {
  id: string;
  category: AssetCategory;
  width: 8 | 16 | 32;
  height: 8 | 16 | 32;
  pixels: number[];
  paletteSlots: number[];
  name?: string;
  frames?: number[][];
  fps?: number;
}

export interface User {
  id: string;
  nickname: string;
}

export type GameMode = 'play' | 'edit';

export interface SelectedEnemyConfig {
  typeId: string;
  behavior: EnemyBehavior;
  assetId?: string;
  patrolRange?: number;
}

export interface EditorTool {
  type: 'platform' | 'enemy' | 'spawn' | 'portal' | 'select' | 'delete';
}
