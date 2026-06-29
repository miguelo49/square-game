import { useNavigate } from 'react-router-dom';
import type { AssetSchema, PlatformDef, PlatformPresetParams, PlatformAction } from '../types';
import {
  getPlatformPreset,
  applyPlatformPreset,
  resolvePlatformRules,
} from '../data/platformPresets';
import { PlatformRuleBuilder } from './PlatformRuleBuilder';
import { paletteColor } from '../data/snesPalette';
import { migrateAssetAnimations } from '../game/utils/assetAnimations';

const PRESET_CHIPS = [
  { id: 'static', icon: '▬', label: 'Estática' },
  { id: 'elevator', icon: '↕', label: 'Ascensor' },
  { id: 'crumbling', icon: '💨', label: 'Desmorona' },
  { id: 'conveyor', icon: '→', label: 'Cinta' },
  { id: 'respawnBelow', icon: '↓', label: 'Respawn' },
] as const;

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

function AssetPreview({ asset }: { asset: AssetSchema }) {
  const frames = migrateAssetAnimations(asset).idle?.frames?.[0] ?? asset.pixels;
  const w = asset.width;
  const scale = Math.max(1, Math.floor(32 / w));

  return (
    <canvas
      className="platform-asset-preview"
      width={w * scale}
      height={w * scale}
      ref={(canvas) => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let y = 0; y < w; y++) {
          for (let x = 0; x < w; x++) {
            const idx = frames[y * w + x] ?? 0;
            if (idx === 0) continue;
            const master = asset.paletteSlots[idx] ?? idx;
            ctx.fillStyle = paletteColor(master);
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        }
      }}
    />
  );
}

interface PlatformInspectorProps {
  platform: PlatformDef | null;
  assets: AssetSchema[];
  onChange: (platform: PlatformDef) => void;
  onClear: () => void;
}

export function PlatformInspector({
  platform,
  assets,
  onChange,
  onClear,
}: PlatformInspectorProps) {
  const navigate = useNavigate();
  const platformAssets = assets.filter((a) => a.category === 'platform');
  const preset = platform ? getPlatformPreset(platform.presetId ?? 'static') : null;
  const selectedAsset = platform?.assetId
    ? platformAssets.find((a) => a.id === platform.assetId)
    : undefined;

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

  if (!platform) {
    return (
      <div className="inspector-empty">
        <p className="hint">Selecciona una plataforma con la herramienta ◎</p>
        <p className="hint guide-steps">
          1) Coloca con ▬ · 2) Selecciona con ◎ · 3) Elige comportamiento
        </p>
      </div>
    );
  }

  return (
    <div className="platform-inspector-compact">
      <p className="hint guide-steps">
        Plataforma en ({Math.round(platform.x)}, {Math.round(platform.y)})
      </p>

      <h4>Tipo</h4>
      <div className="preset-chips platform-preset-chips">
        {PRESET_CHIPS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`retro-btn small preset-chip ${(platform.presetId ?? 'static') === p.id ? 'active' : ''}`}
            title={getPlatformPreset(p.id)?.description}
            onClick={() => applyPreset(p.id)}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {preset?.description && preset.id !== 'static' && (
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

      <h4>Aspecto</h4>
      <label>
        Asset de tile
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

      {platformAssets.length === 0 && (
        <button type="button" className="retro-btn small" onClick={() => navigate('/assets')}>
          Crear asset de plataforma →
        </button>
      )}

      {selectedAsset && <AssetPreview asset={selectedAsset} />}

      <details className="advanced-rules">
        <summary>Avanzado: reglas custom</summary>
        <PlatformRuleBuilder platform={platform} onChange={onChange} />
      </details>

      <details className="advanced-rules">
        <summary>Tamaño y colisión</summary>
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
      </details>

      <button className="retro-btn small secondary" onClick={onClear}>
        Deseleccionar
      </button>
    </div>
  );
}
