import { v4 as uuidv4 } from 'uuid';
import type { PlatformDef, PlatformPresetParams, PlatformRule } from '../types';

export interface PlatformPreset {
  id: string;
  label: string;
  description: string;
  buildRules: (params?: PlatformPresetParams) => PlatformRule[];
  defaultParams?: PlatformPresetParams;
}

export const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    id: 'custom',
    label: 'Custom (reglas)',
    description: 'Comportamiento definido por reglas manuales',
    buildRules: () => [],
  },
  {
    id: 'static',
    label: 'Estática',
    description: 'Sin movimiento ni efectos',
    buildRules: () => [],
  },
  {
    id: 'elevator',
    label: 'Ascensor',
    description: 'Oscila arriba/abajo',
    defaultParams: { speed: 60, distance: 128 },
    buildRules: (p) => [
      {
        id: uuidv4(),
        trigger: 'always',
        loop: true,
        actions: [
          {
            type: 'move',
            axis: 'y',
            speed: p?.speed ?? 60,
            distance: p?.distance ?? 128,
            pingPong: true,
          },
        ],
      },
    ],
  },
  {
    id: 'crumbling',
    label: 'Se desmorona',
    description: 'Desaparece tras pisarla',
    defaultParams: { delay: 400 },
    buildRules: (p) => [
      {
        id: uuidv4(),
        trigger: 'afterTouch',
        delay: p?.delay ?? 400,
        once: true,
        actions: [
          { type: 'fade', duration: 500, destroyAfter: true },
        ],
      },
    ],
  },
  {
    id: 'conveyor',
    label: 'Cinta',
    description: 'Se mueve horizontalmente',
    defaultParams: { speed: 80 },
    buildRules: (p) => [
      {
        id: uuidv4(),
        trigger: 'always',
        loop: true,
        actions: [
          {
            type: 'move',
            axis: 'x',
            speed: p?.speed ?? 80,
            distance: 0,
            pingPong: false,
          },
        ],
      },
    ],
  },
  {
    id: 'respawnBelow',
    label: 'Respawn abajo',
    description: 'Al salir de pantalla, clona debajo',
    defaultParams: { offScreenMargin: 64, offsetY: 400 },
    buildRules: (p) => [
      {
        id: uuidv4(),
        trigger: 'offScreen',
        once: true,
        offScreenMargin: p?.offScreenMargin ?? 64,
        actions: [
          {
            type: 'spawn',
            offsetY: p?.offsetY ?? 400,
          },
        ],
      },
    ],
  },
];

export function getPlatformPreset(id: string): PlatformPreset | undefined {
  return PLATFORM_PRESETS.find((p) => p.id === id);
}

export function expandPlatformPreset(
  def: PlatformDef,
  params?: PlatformPresetParams
): PlatformDef {
  if (def.presetId === 'custom') return def;
  if (!def.presetId || def.presetId === 'static') {
    return { ...def, rules: undefined, presetId: def.presetId ?? 'static' };
  }
  const preset = getPlatformPreset(def.presetId);
  if (!preset) return def;
  return {
    ...def,
    rules: preset.buildRules({ ...preset.defaultParams, ...params }),
  };
}

export function applyPlatformPreset(
  def: PlatformDef,
  presetId: string,
  params?: PlatformPresetParams
): PlatformDef {
  if (presetId === 'static') {
    return { ...def, presetId: 'static', rules: undefined };
  }
  const preset = getPlatformPreset(presetId);
  if (!preset) return def;
  return {
    ...def,
    presetId,
    rules: preset.buildRules({ ...preset.defaultParams, ...params }),
  };
}

export function resolvePlatformRules(def: PlatformDef): PlatformRule[] {
  if (def.rules?.length) return def.rules;
  if (def.presetId && def.presetId !== 'static') {
    return expandPlatformPreset(def).rules ?? [];
  }
  return [];
}

export function platformHasMovement(def: PlatformDef): boolean {
  return resolvePlatformRules(def).some((r) =>
    r.actions.some((a) => a.type === 'move' || a.type === 'path')
  );
}
