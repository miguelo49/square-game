import type { AssetSchema, SelectedEnemyConfig } from '../types';
import { ENEMY_PRESETS, DEFAULT_ENEMY_SELECTION } from '../game/entities/enemyRegistry';
import { paletteColor } from '../data/snesPalette';

interface EnemyPaletteProps {
  assets: AssetSchema[];
  selected: SelectedEnemyConfig;
  onChange: (cfg: SelectedEnemyConfig) => void;
}

function miniPreview(asset: AssetSchema): string {
  const w = asset.width;
  const h = asset.height;
  const frame = asset.frames?.[0] ?? asset.pixels;
  const scale = Math.max(1, Math.floor(24 / Math.max(w, h)));
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = frame[y * w + x] ?? 0;
      if (idx === 0) continue;
      const master = asset.paletteSlots[idx] ?? idx;
      ctx.fillStyle = paletteColor(master);
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return canvas.toDataURL();
}

export function EnemyPalette({ assets, selected, onChange }: EnemyPaletteProps) {
  const enemyAssets = assets.filter((a) => a.category === 'enemy');

  const selectPreset = (typeId: string) => {
    const preset = ENEMY_PRESETS.find((p) => p.typeId === typeId);
    if (!preset) return;
    onChange({
      typeId: preset.typeId,
      behavior: preset.behavior,
      patrolRange: preset.patrolRange,
      assetId: undefined,
    });
  };

  const selectAsset = (assetId: string) => {
    onChange({
      ...selected,
      assetId,
    });
  };

  return (
    <div className="enemy-palette">
      <h3>Enemigo</h3>
      <p className="hint">Elige tipo antes de colocar con △</p>

      <h4>Presets</h4>
      {ENEMY_PRESETS.map((p) => (
        <button
          key={p.typeId}
          className={`retro-btn palette-btn small ${
            selected.typeId === p.typeId && !selected.assetId ? 'active' : ''
          }`}
          onClick={() => selectPreset(p.typeId)}
        >
          {p.label}
        </button>
      ))}

      {enemyAssets.length > 0 && (
        <>
          <h4>Mis enemigos</h4>
          <div className="enemy-asset-grid">
            {enemyAssets.map((a) => (
              <button
                key={a.id}
                className={`enemy-asset-btn ${selected.assetId === a.id ? 'active' : ''}`}
                onClick={() => selectAsset(a.id)}
                title={a.name ?? a.id}
              >
                <img src={miniPreview(a)} alt="" width={24} height={24} />
                <span>{a.name ?? 'Asset'}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {selected.assetId && (
        <button
          className="retro-btn small secondary"
          onClick={() => onChange({ ...DEFAULT_ENEMY_SELECTION })}
        >
          Quitar asset custom
        </button>
      )}
    </div>
  );
}
