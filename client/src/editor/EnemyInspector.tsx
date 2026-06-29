import type { AssetSchema, EnemyDef, EnemyBehavior } from '../types';
import { ENEMY_PRESETS } from '../game/entities/enemyRegistry';

interface EnemyInspectorProps {
  enemies: EnemyDef[];
  selectedId: string | null;
  assets: AssetSchema[];
  onSelect: (id: string) => void;
  onChange: (enemy: EnemyDef) => void;
  onClear: () => void;
}

const BEHAVIORS: { value: EnemyBehavior; label: string }[] = [
  { value: 'patrol', label: 'Patrulla' },
  { value: 'chase', label: 'Persigue' },
  { value: 'stationary', label: 'Quieto' },
  { value: 'hopper', label: 'Saltarín' },
];

export function EnemyInspector({
  enemies,
  selectedId,
  assets,
  onSelect,
  onChange,
  onClear,
}: EnemyInspectorProps) {
  const enemy = enemies.find((e) => e.id === selectedId) ?? null;
  const enemyAssets = assets.filter((a) => a.category === 'enemy');

  const patch = (partial: Partial<EnemyDef>) => {
    if (!enemy) return;
    onChange({ ...enemy, ...partial });
  };

  return (
    <div className="enemy-inspector">
      <h3>Inspector enemigo</h3>
      {enemies.length === 0 ? (
        <p className="hint">Sin enemigos en el nivel</p>
      ) : (
        <div className="enemy-list-compact">
          {enemies.map((e, i) => (
            <button
              key={e.id}
              className={`retro-btn small ${selectedId === e.id ? 'active' : ''}`}
              onClick={() => onSelect(e.id)}
            >
              #{i + 1} {e.behavior} ({Math.round(e.x)}, {Math.round(e.y)})
            </button>
          ))}
        </div>
      )}

      {enemy ? (
        <div className="enemy-inspector-form">
          <label>
            Comportamiento
            <select
              className="retro-input"
              value={enemy.behavior}
              onChange={(e) => {
                const behavior = e.target.value as EnemyBehavior;
                const preset = ENEMY_PRESETS.find((p) => p.behavior === behavior);
                patch({
                  behavior,
                  typeId: preset?.typeId,
                  patrolRange: preset?.patrolRange ?? enemy.patrolRange,
                });
              }}
            >
              {BEHAVIORS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          {(enemy.behavior === 'patrol' || enemy.behavior === 'hopper' || enemy.behavior === 'chase') && (
            <label>
              Rango patrulla
              <input
                type="number"
                className="retro-input"
                min={32}
                max={512}
                value={enemy.patrolRange ?? 128}
                onChange={(e) => patch({ patrolRange: Number(e.target.value) })}
              />
            </label>
          )}

          <label>
            Preset
            <select
              className="retro-input"
              value={enemy.typeId ?? ''}
              onChange={(e) => {
                const preset = ENEMY_PRESETS.find((p) => p.typeId === e.target.value);
                if (preset) {
                  patch({
                    typeId: preset.typeId,
                    behavior: preset.behavior,
                    patrolRange: preset.patrolRange,
                  });
                }
              }}
            >
              {ENEMY_PRESETS.map((p) => (
                <option key={p.typeId} value={p.typeId}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Asset custom
            <select
              className="retro-input"
              value={enemy.assetId ?? ''}
              onChange={(e) =>
                patch({ assetId: e.target.value || undefined })
              }
            >
              <option value="">Default △</option>
              {enemyAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.id}
                </option>
              ))}
            </select>
          </label>

          <button className="retro-btn small secondary" onClick={onClear}>
            Deseleccionar
          </button>
        </div>
      ) : (
        <p className="hint">Usa Seleccionar y click en un enemigo</p>
      )}
    </div>
  );
}
