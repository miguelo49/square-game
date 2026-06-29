export type AssetCategory = 'player' | 'platform' | 'enemy';
export type EnemyBehavior = 'patrol' | 'chase' | 'stationary' | 'hopper';
export type SkillTriggerType = 'keydown' | 'keyup' | 'hold';
export type SkillConditionType = 'onGround' | 'inAir' | 'cooldownReady';
export type SkillActionType =
  | 'jump'
  | 'move'
  | 'dash'
  | 'gravity'
  | 'impulse'
  | 'shoot'
  | 'scale'
  | 'rotate'
  | 'custom';

export type AssetAnimClip = 'idle' | 'walk' | 'jump' | 'fall' | 'shoot' | 'hurt';

export const ASSET_ANIM_CLIPS: AssetAnimClip[] = [
  'idle',
  'walk',
  'jump',
  'fall',
  'shoot',
  'hurt',
];

export interface AssetClipDef {
  frames: number[][];
  fps?: number;
  loop?: boolean;
}

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

export interface MusicTrackExport {
  name: string;
  data: MusicSchema;
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
  musicTrackId?: string;
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
  duration?: number;
  degrees?: number;
  spinSpeed?: number;
  projectileAssetId?: string;
  projectileSpeed?: number;
  projectileLife?: number;
  animClip?: AssetAnimClip;
  customName?: string;
  script?: string;
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
  animClip?: AssetAnimClip;
}

export interface AssetSchema {
  id: string;
  category: AssetCategory;
  width: 8 | 16 | 32;
  height: 8 | 16 | 32;
  pixels: number[];
  paletteSlots: number[];
  name?: string;
  /** @deprecated use animations.idle */
  frames?: number[][];
  /** @deprecated use animations.idle.fps */
  fps?: number;
  animations?: Partial<Record<AssetAnimClip, AssetClipDef>>;
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

export interface EditorSelection {
  type: 'enemy';
  id: string;
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  timeMs: number;
  deaths: number;
  achievedAt: number;
}

export interface RunResult {
  timeMs: number;
  deaths: number;
}

export interface MusicTrackItem {
  id: string;
  name: string;
  data: MusicSchema;
  isPublic?: boolean;
  authorNickname?: string;
}
