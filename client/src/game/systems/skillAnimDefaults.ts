import type { AssetAnimClip, SkillAction, SkillActionType } from '../../types';

const DEFAULT_ANIM: Partial<Record<SkillActionType, AssetAnimClip>> = {
  jump: 'jump',
  impulse: 'jump',
  shoot: 'shoot',
  dash: 'walk',
};

export function resolveActionAnimClip(
  action: SkillAction,
  skillAnimClip?: AssetAnimClip
): AssetAnimClip | undefined {
  if (action.animClip) return action.animClip;
  if (skillAnimClip) return skillAnimClip;
  if (action.type === 'impulse' && action.axis === 'x') return undefined;
  if (action.type === 'move') return undefined;
  if (action.type === 'custom') return action.animClip;
  return DEFAULT_ANIM[action.type];
}

export const ONE_SHOT_CLIPS: Set<AssetAnimClip> = new Set([
  'jump',
  'shoot',
  'walk',
  'hurt',
]);
