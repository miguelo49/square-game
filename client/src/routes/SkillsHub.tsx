import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import type { SkillSchema, SkillAction, SkillActionType, AssetSchema } from '../types';
import { KEY_OPTIONS, ACTION_OPTIONS } from '../data/retroLimits';
import { api } from '../api/client';

const DEFAULT_ACTION = (): SkillAction => ({ type: 'jump', force: 420 });

export function SkillsHub() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<SkillSchema[]>([]);
  const [assets, setAssets] = useState<AssetSchema[]>([]);
  const [editing, setEditing] = useState<SkillSchema | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [sk, as] = await Promise.all([api.skills.list(), api.assets.list()]);
    setSkills(sk.map((s) => s.data));
    setAssets(as.map((a) => a.data));
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setEditing({
      id: uuidv4(),
      name: 'Nueva habilidad',
      trigger: { type: 'keydown', key: 'SPACE' },
      actions: [DEFAULT_ACTION()],
      conditions: [],
    });
    setError('');
  };

  const startEdit = (skill: SkillSchema) => {
    if (skill.id.startsWith('skill_')) return;
    setEditing(JSON.parse(JSON.stringify(skill)));
    setError('');
  };

  const patchEditing = (partial: Partial<SkillSchema>) => {
    if (!editing) return;
    setEditing({ ...editing, ...partial });
  };

  const updateAction = (idx: number, partial: Partial<SkillAction>) => {
    if (!editing) return;
    const actions = editing.actions.map((a, i) => (i === idx ? { ...a, ...partial } : a));
    patchEditing({ actions });
  };

  const addAction = () => {
    if (!editing) return;
    patchEditing({ actions: [...editing.actions, DEFAULT_ACTION()] });
  };

  const removeAction = (idx: number) => {
    if (!editing || editing.actions.length <= 1) return;
    patchEditing({ actions: editing.actions.filter((_, i) => i !== idx) });
  };

  const toggleCondition = (type: 'onGround' | 'inAir' | 'cooldownReady') => {
    if (!editing) return;
    const has = editing.conditions?.some((c) => c.type === type);
    const conditions = has
      ? (editing.conditions ?? []).filter((c) => c.type !== type)
      : [...(editing.conditions ?? []), { type }];
    patchEditing({ conditions: conditions.length ? conditions : undefined });
  };

  const saveSkill = async () => {
    if (!editing) return;
    setError('');
    try {
      const existing = skills.find((s) => s.id === editing.id);
      if (existing) {
        await api.skills.update(editing.id, editing);
      } else {
        await api.skills.create(editing.name, editing);
      }
      setMessage('Habilidad guardada!');
      setEditing(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteSkill = async (id: string) => {
    if (id.startsWith('skill_')) return;
    await api.skills.delete(id);
    if (editing?.id === id) setEditing(null);
    await load();
  };

  const renderActionFields = (action: SkillAction, idx: number) => (
    <div key={idx} className="action-block">
      <div className="action-header">
        <select
          className="retro-input"
          value={action.type}
          onChange={(e) =>
            updateAction(idx, { type: e.target.value as SkillActionType })
          }
        >
          {ACTION_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <button className="retro-btn small danger" onClick={() => removeAction(idx)}>
          ✕
        </button>
      </div>
      {(action.type === 'jump' || action.type === 'impulse') && (
        <label>
          Fuerza
          <input
            type="number"
            className="retro-input"
            value={action.force ?? 420}
            onChange={(e) => updateAction(idx, { force: Number(e.target.value) })}
          />
        </label>
      )}
      {action.type === 'impulse' && (
        <label>
          Eje
          <select
            className="retro-input"
            value={action.axis ?? 'y'}
            onChange={(e) => updateAction(idx, { axis: e.target.value as 'x' | 'y' })}
          >
            <option value="y">Y (vertical)</option>
            <option value="x">X (horizontal)</option>
          </select>
        </label>
      )}
      {action.type === 'move' && (
        <>
          <label>
            Velocidad X
            <input
              type="number"
              className="retro-input"
              value={action.speed ?? 220}
              onChange={(e) =>
                updateAction(idx, { axis: 'x', speed: Number(e.target.value) })
              }
            />
          </label>
        </>
      )}
      {action.type === 'dash' && (
        <>
          <label>
            Distancia
            <input
              type="number"
              className="retro-input"
              value={action.distance ?? 160}
              onChange={(e) => updateAction(idx, { distance: Number(e.target.value) })}
            />
          </label>
          <label>
            Cooldown ms
            <input
              type="number"
              className="retro-input"
              value={action.cooldown ?? 800}
              onChange={(e) => updateAction(idx, { cooldown: Number(e.target.value) })}
            />
          </label>
        </>
      )}
      {action.type === 'gravity' && (
        <label>
          Multiplicador
          <input
            type="number"
            step={0.1}
            className="retro-input"
            value={action.multiplier ?? 1}
            onChange={(e) => updateAction(idx, { multiplier: Number(e.target.value) })}
          />
        </label>
      )}
      {action.type === 'scale' && (
        <>
          <label>
            Escala
            <input
              type="number"
              step={0.1}
              className="retro-input"
              value={action.multiplier ?? 1.5}
              onChange={(e) => updateAction(idx, { multiplier: Number(e.target.value) })}
            />
          </label>
          <label>
            Duración ms
            <input
              type="number"
              className="retro-input"
              value={action.duration ?? 400}
              onChange={(e) => updateAction(idx, { duration: Number(e.target.value) })}
            />
          </label>
        </>
      )}
      {action.type === 'rotate' && (
        <>
          <label>
            Grados
            <input
              type="number"
              className="retro-input"
              value={action.degrees ?? 360}
              onChange={(e) => updateAction(idx, { degrees: Number(e.target.value) })}
            />
          </label>
          <label>
            Duración ms
            <input
              type="number"
              className="retro-input"
              value={action.duration ?? 500}
              onChange={(e) => updateAction(idx, { duration: Number(e.target.value) })}
            />
          </label>
        </>
      )}
      {action.type === 'shoot' && (
        <>
          <label>
            Asset proyectil
            <select
              className="retro-input"
              value={action.projectileAssetId ?? ''}
              onChange={(e) =>
                updateAction(idx, { projectileAssetId: e.target.value || undefined })
              }
            >
              <option value="">Default</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.id} ({a.category})
                </option>
              ))}
            </select>
          </label>
          <label>
            Velocidad
            <input
              type="number"
              className="retro-input"
              value={action.projectileSpeed ?? 420}
              onChange={(e) =>
                updateAction(idx, { projectileSpeed: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Vida ms
            <input
              type="number"
              className="retro-input"
              value={action.projectileLife ?? 2000}
              onChange={(e) =>
                updateAction(idx, { projectileLife: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Cooldown ms
            <input
              type="number"
              className="retro-input"
              value={action.cooldown ?? 300}
              onChange={(e) => updateAction(idx, { cooldown: Number(e.target.value) })}
            />
          </label>
        </>
      )}
    </div>
  );

  return (
    <div className="skills-hub-page">
      <header className="page-header">
        <button className="retro-btn secondary" onClick={() => navigate('/')}>
          ← Menú
        </button>
        <h2>Habilidades</h2>
        <button className="retro-btn primary" onClick={startNew}>
          + Nueva habilidad
        </button>
      </header>

      {message && <p className="toast">{message}</p>}

      <div className="skills-hub-layout">
        <aside className="skills-hub-list">
          <h3>Biblioteca</h3>
          {skills.map((skill) => (
            <div key={skill.id} className="skill-item">
              <button
                className="retro-btn small"
                onClick={() => startEdit(skill)}
                disabled={skill.id.startsWith('skill_')}
              >
                {skill.name} — {skill.trigger.key}
              </button>
              {!skill.id.startsWith('skill_') && (
                <button
                  className="retro-btn small danger"
                  onClick={() => deleteSkill(skill.id)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <p className="hint">Presets del sistema (skill_*) no se editan aquí</p>
        </aside>

        <div className="skills-hub-editor">
          {editing ? (
            <div className="skill-form full">
              <h3>{editing.name}</h3>
              <label>
                Nombre
                <input
                  className="retro-input"
                  value={editing.name}
                  onChange={(e) => patchEditing({ name: e.target.value })}
                />
              </label>
              <label>
                Tecla
                <select
                  className="retro-input"
                  value={editing.trigger.key}
                  onChange={(e) =>
                    patchEditing({ trigger: { ...editing.trigger, key: e.target.value } })
                  }
                >
                  {KEY_OPTIONS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Trigger
                <select
                  className="retro-input"
                  value={editing.trigger.type}
                  onChange={(e) =>
                    patchEditing({
                      trigger: {
                        ...editing.trigger,
                        type: e.target.value as SkillSchema['trigger']['type'],
                      },
                    })
                  }
                >
                  <option value="keydown">Al presionar</option>
                  <option value="hold">Mantener</option>
                  <option value="keyup">Al soltar</option>
                </select>
              </label>

              <h4>Condiciones (opcional)</h4>
              <div className="condition-row">
                <label>
                  <input
                    type="checkbox"
                    checked={editing.conditions?.some((c) => c.type === 'onGround') ?? false}
                    onChange={() => toggleCondition('onGround')}
                  />
                  Solo en suelo
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={editing.conditions?.some((c) => c.type === 'inAir') ?? false}
                    onChange={() => toggleCondition('inAir')}
                  />
                  Solo en aire
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={
                      editing.conditions?.some((c) => c.type === 'cooldownReady') ?? false
                    }
                    onChange={() => toggleCondition('cooldownReady')}
                  />
                  Cooldown listo
                </label>
              </div>

              <h4>Acciones (cadena)</h4>
              {editing.actions.map((a, i) => renderActionFields(a, i))}
              <button className="retro-btn small" onClick={addAction}>
                + Añadir acción
              </button>

              {error && <p className="error">{error}</p>}
              <div className="btn-row">
                <button className="retro-btn" onClick={saveSkill}>
                  Guardar
                </button>
                <button className="retro-btn secondary" onClick={() => setEditing(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p className="hint">
              Crea habilidades totipotenciales: salto en aire (sin condición suelo), disparo con
              asset, escala, rotación, impulso, dash, gravedad… Combina varias acciones en una.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
