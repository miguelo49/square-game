import type { SkillSchema } from '../types';

export interface SkillPreset {
  id: string;
  label: string;
  description: string;
  /** System skill id if it maps to a seeded skill */
  systemSkillId?: string;
  skill: Omit<SkillSchema, 'id'>;
}

export const SKILL_PRESETS: SkillPreset[] = [
  {
    id: 'preset_jump',
    label: 'Salto básico',
    description: 'SPACE — salto en suelo',
    systemSkillId: 'skill_jump',
    skill: {
      name: 'Saltar',
      trigger: { type: 'keydown', key: 'SPACE' },
      actions: [{ type: 'jump', force: 420, animClip: 'jump' }],
      conditions: [{ type: 'onGround' }],
      animClip: 'jump',
    },
  },
  {
    id: 'preset_move_left',
    label: 'Correr izq',
    description: 'Mantener LEFT',
    systemSkillId: 'skill_move_left',
    skill: {
      name: 'Correr Izquierda',
      trigger: { type: 'hold', key: 'LEFT' },
      actions: [{ type: 'move', axis: 'x', speed: -220 }],
    },
  },
  {
    id: 'preset_move_right',
    label: 'Correr der',
    description: 'Mantener RIGHT',
    systemSkillId: 'skill_move_right',
    skill: {
      name: 'Correr Derecha',
      trigger: { type: 'hold', key: 'RIGHT' },
      actions: [{ type: 'move', axis: 'x', speed: 220 }],
    },
  },
  {
    id: 'preset_move_a',
    label: 'Correr A',
    description: 'Mantener A',
    systemSkillId: 'skill_move_left_a',
    skill: {
      name: 'Correr Izq (A)',
      trigger: { type: 'hold', key: 'A' },
      actions: [{ type: 'move', axis: 'x', speed: -220 }],
    },
  },
  {
    id: 'preset_move_d',
    label: 'Correr D',
    description: 'Mantener D',
    systemSkillId: 'skill_move_right_d',
    skill: {
      name: 'Correr Der (D)',
      trigger: { type: 'hold', key: 'D' },
      actions: [{ type: 'move', axis: 'x', speed: 220 }],
    },
  },
  {
    id: 'preset_dash',
    label: 'Dash',
    description: 'SHIFT — impulso con cooldown',
    systemSkillId: 'skill_dash',
    skill: {
      name: 'Dash',
      trigger: { type: 'keydown', key: 'SHIFT' },
      actions: [{ type: 'dash', distance: 160, cooldown: 800, animClip: 'walk' }],
      conditions: [{ type: 'cooldownReady' }],
      animClip: 'walk',
    },
  },
  {
    id: 'preset_shoot',
    label: 'Disparo',
    description: 'Z — proyectil + anim shoot',
    skill: {
      name: 'Disparar',
      trigger: { type: 'keydown', key: 'Z' },
      actions: [
        {
          type: 'shoot',
          projectileSpeed: 420,
          projectileLife: 2000,
          cooldown: 300,
          animClip: 'shoot',
        },
      ],
      animClip: 'shoot',
    },
  },
  {
    id: 'preset_double_jump',
    label: 'Doble salto',
    description: 'SPACE en aire — segundo impulso',
    skill: {
      name: 'Doble salto',
      trigger: { type: 'keydown', key: 'SPACE' },
      actions: [{ type: 'impulse', axis: 'y', force: 320, animClip: 'jump' }],
      conditions: [{ type: 'inAir' }],
      animClip: 'jump',
    },
  },
  {
    id: 'preset_low_gravity',
    label: 'Gravedad baja',
    description: 'W — gravedad reducida al mantener',
    skill: {
      name: 'Gravedad baja',
      trigger: { type: 'hold', key: 'W' },
      actions: [{ type: 'gravity', multiplier: 0.4 }],
    },
  },
];

export function clonePresetSkill(preset: SkillPreset, id: string): SkillSchema {
  return {
    id,
    ...JSON.parse(JSON.stringify(preset.skill)),
  };
}
