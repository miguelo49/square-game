import { v4 as uuidv4 } from 'uuid';
import type {
  PlatformAction,
  PlatformActionType,
  PlatformDef,
  PlatformRule,
  PlatformTriggerType,
} from '../types';
import { validatePlatformScript } from '../game/systems/PlatformScriptRunner';

interface PlatformRuleBuilderProps {
  platform: PlatformDef;
  onChange: (platform: PlatformDef) => void;
}

const TRIGGERS: { value: PlatformTriggerType; label: string }[] = [
  { value: 'always', label: 'Siempre (cada frame)' },
  { value: 'onTouch', label: 'Al pisar' },
  { value: 'onLeave', label: 'Al salir' },
  { value: 'afterTouch', label: 'Tras pisar (delay)' },
  { value: 'offScreen', label: 'Fuera de pantalla' },
  { value: 'interval', label: 'Intervalo' },
];

const ACTIONS: { value: PlatformActionType; label: string }[] = [
  { value: 'move', label: 'Mover' },
  { value: 'path', label: 'Ruta (waypoints)' },
  { value: 'fade', label: 'Desvanecer' },
  { value: 'spawn', label: 'Spawn clon' },
  { value: 'setSolid', label: 'Colisión on/off' },
  { value: 'destroy', label: 'Destruir' },
  { value: 'custom', label: 'Script custom' },
];

function defaultAction(type: PlatformActionType): PlatformAction {
  switch (type) {
    case 'move':
      return { type, axis: 'y', speed: 60, distance: 128, pingPong: true };
    case 'path':
      return { type, speed: 80, waypoints: [{ x: 0, y: 0 }, { x: 64, y: 0 }] };
    case 'fade':
      return { type, duration: 500, destroyAfter: true };
    case 'spawn':
      return { type, offsetY: 400 };
    case 'setSolid':
      return { type, solid: false };
    case 'custom':
      return { type, script: '// ctx.moveBy(0, -1);\n' };
    default:
      return { type: 'destroy' };
  }
}

function defaultRule(): PlatformRule {
  return {
    id: uuidv4(),
    trigger: 'always',
    actions: [defaultAction('move')],
    loop: true,
  };
}

export function PlatformRuleBuilder({ platform, onChange }: PlatformRuleBuilderProps) {
  const rules = platform.rules ?? [];

  const setRules = (next: PlatformRule[]) => {
    onChange({
      ...platform,
      rules: next,
      presetId: 'custom',
    });
  };

  const addRule = () => setRules([...rules, defaultRule()]);

  const updateRule = (id: string, patch: Partial<PlatformRule>) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRule = (id: string) => setRules(rules.filter((r) => r.id !== id));

  const updateAction = (ruleId: string, index: number, patch: Partial<PlatformAction>) => {
    setRules(
      rules.map((r) => {
        if (r.id !== ruleId) return r;
        const actions = r.actions.map((a, i) => (i === index ? { ...a, ...patch } : a));
        return { ...r, actions };
      })
    );
  };

  const addAction = (ruleId: string, type: PlatformActionType) => {
    setRules(
      rules.map((r) =>
        r.id === ruleId ? { ...r, actions: [...r.actions, defaultAction(type)] } : r
      )
    );
  };

  const removeAction = (ruleId: string, index: number) => {
    setRules(
      rules.map((r) => {
        if (r.id !== ruleId) return r;
        return { ...r, actions: r.actions.filter((_, i) => i !== index) };
      })
    );
  };

  const hasInvalidScript = rules.some((r) =>
    r.actions.some((a) => {
      if (a.type !== 'custom' || !a.script) return false;
      return validatePlatformScript(a.script) != null;
    })
  );

  return (
    <div className="platform-rule-builder">
      <h4>Reglas avanzadas</h4>
      <p className="hint">Encadena triggers y acciones (modo totipotencial)</p>

      {rules.map((rule) => (
        <div key={rule.id} className="rule-card">
          <label>
            Trigger
            <select
              className="retro-input"
              value={rule.trigger}
              onChange={(e) =>
                updateRule(rule.id, { trigger: e.target.value as PlatformTriggerType })
              }
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {rule.trigger === 'afterTouch' && (
            <label>
              Delay (ms)
              <input
                type="number"
                className="retro-input"
                value={rule.delay ?? 400}
                onChange={(e) => updateRule(rule.id, { delay: Number(e.target.value) })}
              />
            </label>
          )}

          {rule.trigger === 'interval' && (
            <label>
              Intervalo (ms)
              <input
                type="number"
                className="retro-input"
                value={rule.interval ?? 1000}
                onChange={(e) => updateRule(rule.id, { interval: Number(e.target.value) })}
              />
            </label>
          )}

          {rule.trigger === 'offScreen' && (
            <label>
              Margen (px)
              <input
                type="number"
                className="retro-input"
                value={rule.offScreenMargin ?? 64}
                onChange={(e) =>
                  updateRule(rule.id, { offScreenMargin: Number(e.target.value) })
                }
              />
            </label>
          )}

          <label>
            <input
              type="checkbox"
              checked={rule.once ?? false}
              onChange={(e) => updateRule(rule.id, { once: e.target.checked })}
            />
            Una sola vez
          </label>

          <div className="rule-actions">
            {rule.actions.map((action, ai) => (
              <div key={ai} className="action-row">
                <select
                  className="retro-input"
                  value={action.type}
                  onChange={(e) =>
                    updateAction(rule.id, ai, defaultAction(e.target.value as PlatformActionType))
                  }
                >
                  {ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>

                {action.type === 'move' && (
                  <>
                    <select
                      className="retro-input"
                      value={action.axis ?? 'y'}
                      onChange={(e) =>
                        updateAction(rule.id, ai, { axis: e.target.value as 'x' | 'y' })
                      }
                    >
                      <option value="x">Eje X</option>
                      <option value="y">Eje Y</option>
                    </select>
                    <input
                      type="number"
                      className="retro-input"
                      placeholder="speed"
                      value={action.speed ?? 60}
                      onChange={(e) =>
                        updateAction(rule.id, ai, { speed: Number(e.target.value) })
                      }
                    />
                    <input
                      type="number"
                      className="retro-input"
                      placeholder="distance"
                      value={action.distance ?? 0}
                      onChange={(e) =>
                        updateAction(rule.id, ai, { distance: Number(e.target.value) })
                      }
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={action.pingPong ?? false}
                        onChange={(e) =>
                          updateAction(rule.id, ai, { pingPong: e.target.checked })
                        }
                      />
                      Ping-pong
                    </label>
                  </>
                )}

                {action.type === 'fade' && (
                  <input
                    type="number"
                    className="retro-input"
                    placeholder="duration ms"
                    value={action.duration ?? 500}
                    onChange={(e) =>
                      updateAction(rule.id, ai, { duration: Number(e.target.value) })
                    }
                  />
                )}

                {action.type === 'spawn' && (
                  <input
                    type="number"
                    className="retro-input"
                    placeholder="offsetY"
                    value={action.offsetY ?? 400}
                    onChange={(e) =>
                      updateAction(rule.id, ai, { offsetY: Number(e.target.value) })
                    }
                  />
                )}

                {action.type === 'custom' && (
                  <textarea
                    className="retro-input script-area"
                    rows={3}
                    value={action.script ?? ''}
                    onChange={(e) => updateAction(rule.id, ai, { script: e.target.value })}
                  />
                )}

                <button
                  type="button"
                  className="retro-btn small danger"
                  onClick={() => removeAction(rule.id, ai)}
                >
                  ✕
                </button>
              </div>
            ))}

            <div className="btn-row">
              <select
                className="retro-input"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    addAction(rule.id, e.target.value as PlatformActionType);
                    e.target.value = '';
                  }
                }}
              >
                <option value="">+ Acción</option>
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="retro-btn small danger"
            onClick={() => removeRule(rule.id)}
          >
            Eliminar regla
          </button>
        </div>
      ))}

      <button type="button" className="retro-btn small" onClick={addRule}>
        + Añadir regla
      </button>

      {hasInvalidScript && (
        <p className="hint danger-text">Hay scripts con errores de validación</p>
      )}
    </div>
  );
}
