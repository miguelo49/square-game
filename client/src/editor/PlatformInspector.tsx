import type { AssetSchema, PlatformDef, PlatformPresetParams, PlatformAction } from '../types';
import {
  PLATFORM_PRESETS,
  applyPlatformPreset,
  getPlatformPreset,
  resolvePlatformRules,
} from '../data/platformPresets';
import { PlatformRuleBuilder } from './PlatformRuleBuilder';

function readMoveParam(platform: PlatformDef, key: keyof PlatformAction, fallback: number): number {
  const action = resolvePlatformRules(platform)
    .flatMap((r) => r.actions)
    .find((a) => a.type === 'move');
  const val = action?.[key];
  return typeof val === 'number' ? val : fallback;
}

function readRuleParam(platform: PlatformDef, key: 'delay' | 'offsetY', fallback: number): number {
  for (const rule of resolvePlatformRules(platform)) {
    if (key === 'delay' && rule.delay != null) return rule.delay;
    const spawn = rule.actions.find((a) => a.type === 'spawn');
    if (key === 'offsetY' && spawn?.offsetY != null) return spawn.offsetY;
  }
  return fallback;
}

interface PlatformInspectorProps {
  platforms: PlatformDef[];
  selectedId: string | null;
  assets: AssetSchema[];
  onSelect: (id: string) => void;
  onChange: (platform: PlatformDef) => void;
  onClear: () => void;
}

export function PlatformInspector({
  platforms,
  selectedId,
  assets,
  onSelect,
  onChange,
  onClear,
}: PlatformInspectorProps) {
  const platform = platforms.find((p) => p.id === selectedId) ?? null;
  const platformAssets = assets.filter((a) => a.category === 'platform');
  const preset = platform ? getPlatformPreset(platform.presetId ?? 'static') : null;

  const patch = (partial: Partial<PlatformDef>) => {
    if (!platform) return;
    onChange({ ...platform, ...partial });
  };

  const applyPreset = (presetId: string, params?: PlatformPresetParams) => {
    if (!platform) return;
    onChange(applyPlatformPreset(platform, presetId, params));
  };

  const patchPresetParam = (key: keyof PlatformPresetParams, value: number) => {
    if (!platform?.presetId) return;
    const base = preset?.defaultParams ?? {};
    applyPreset(platform.presetId, { ...base, [key]: value });
  };

  return (
    <div className="enemy-inspector platform-inspector">
      <h3>Inspector plataforma</h3>
      {platforms.length === 0 ? (
        <p className="hint">Sin plataformas en el nivel</p>
      ) : (
        <div className="enemy-list-compact">
          {platforms.map((p, i) => (
            <button
              key={p.id}
              className={`retro-btn small ${selectedId === p.id ? 'active' : ''}`}
              onClick={() => onSelect(p.id)}
            >
              #{i + 1} {p.presetId ?? 'static'} ({Math.round(p.x)}, {Math.round(p.y)})
            </button>
          ))}
        </div>
      )}

      {platform ? (
        <div className="enemy-inspector-form">
          <label>
            Preset
            <select
              className="retro-input"
              value={platform.presetId ?? 'static'}
              onChange={(e) => applyPreset(e.target.value)}
            >
              {PLATFORM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {preset?.description && (
            <p className="hint">{preset.description}</p>
          )}

          {(platform.presetId === 'elevator' || platform.presetId === 'conveyor') && (
            <label>
              Velocidad
              <input
                type="number"
                className="retro-input"
                min={10}
                max={300}
                value={readMoveParam(platform, 'speed', preset?.defaultParams?.speed ?? 60)}
                onChange={(e) => patchPresetParam('speed', Number(e.target.value))}
              />
            </label>
          )}

          {platform.presetId === 'elevator' && (
            <label>
              Distancia (px)
              <input
                type="number"
                className="retro-input"
                min={32}
                max={512}
                step={16}
                value={readMoveParam(platform, 'distance', preset?.defaultParams?.distance ?? 128)}
                onChange={(e) => patchPresetParam('distance', Number(e.target.value))}
              />
            </label>
          )}

          {platform.presetId === 'crumbling' && (
            <label>
              Delay al pisar (ms)
              <input
                type="number"
                className="retro-input"
                min={100}
                max={3000}
                step={50}
                value={readRuleParam(platform, 'delay', preset?.defaultParams?.delay ?? 400)}
                onChange={(e) => patchPresetParam('delay', Number(e.target.value))}
              />
            </label>
          )}

          {platform.presetId === 'respawnBelow' && (
            <label>
              Offset spawn Y (px)
              <input
                type="number"
                className="retro-input"
                min={100}
                max={800}
                step={32}
                value={readRuleParam(platform, 'offsetY', preset?.defaultParams?.offsetY ?? 400)}
                onChange={(e) => patchPresetParam('offsetY', Number(e.target.value))}
              />
            </label>
          )}

          <label>
            Ancho
            <input
              type="number"
              className="retro-input"
              min={16}
              max={640}
              step={16}
              value={platform.w}
              onChange={(e) => patch({ w: Number(e.target.value) })}
            />
          </label>

          <label>
            Alto
            <input
              type="number"
              className="retro-input"
              min={16}
              max={128}
              step={16}
              value={platform.h}
              onChange={(e) => patch({ h: Number(e.target.value) })}
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={platform.solid}
              onChange={(e) => patch({ solid: e.target.checked })}
            />
            Sólida (colisión)
          </label>

          <label>
            Asset custom
            <select
              className="retro-input"
              value={platform.assetId ?? ''}
              onChange={(e) => patch({ assetId: e.target.value || undefined })}
            >
              <option value="">Default ▬</option>
              {platformAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.id}
                </option>
              ))}
            </select>
          </label>

          <PlatformRuleBuilder platform={platform} onChange={onChange} />

          <button className="retro-btn small secondary" onClick={onClear}>
            Deseleccionar
          </button>
        </div>
      ) : (
        <p className="hint">Usa Seleccionar y click en una plataforma</p>
      )}
    </div>
  );
}
