import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { SkillSchema } from '../types';
import { KEY_OPTIONS, ACTION_OPTIONS } from '../data/retroLimits';
import { api } from '../api/client';

interface SkillBuilderProps {
  skills: SkillSchema[];
  selectedSkillIds: string[];
  onSkillsChange: (ids: string[]) => void;
  onRefresh: () => void;
}

export function SkillBuilder({
  skills,
  selectedSkillIds,
  onSkillsChange,
  onRefresh,
}: SkillBuilderProps) {
  const [editing, setEditing] = useState<SkillSchema | null>(null);
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'keydown' | 'keyup' | 'hold'>('keydown');
  const [triggerKey, setTriggerKey] = useState('Space');
  const [actionType, setActionType] = useState('jump');
  const [actionForce, setActionForce] = useState(420);
  const [actionSpeed, setActionSpeed] = useState(220);
  const [needsGround, setNeedsGround] = useState(true);
  const [error, setError] = useState('');

  const startNew = () => {
    setEditing({
      id: uuidv4(),
      name: 'Nueva habilidad',
      trigger: { type: 'keydown', key: 'Space' },
      actions: [{ type: 'jump', force: 420 }],
      conditions: [{ type: 'onGround' }],
    });
    setName('Nueva habilidad');
    setTriggerType('keydown');
    setTriggerKey('Space');
    setActionType('jump');
    setActionForce(420);
    setNeedsGround(true);
  };

  const startEdit = (skill: SkillSchema) => {
    setEditing(skill);
    setName(skill.name);
    setTriggerType(skill.trigger.type);
    setTriggerKey(skill.trigger.key);
    const action = skill.actions[0];
    setActionType(action?.type ?? 'jump');
    setActionForce(action?.force ?? 420);
    setActionSpeed(Math.abs(action?.speed ?? 220));
    setNeedsGround(skill.conditions?.some((c) => c.type === 'onGround') ?? false);
  };

  const saveSkill = async () => {
    if (!editing) return;
    setError('');

    const actions: SkillSchema['actions'] = [];
    if (actionType === 'jump') {
      actions.push({ type: 'jump', force: actionForce });
    } else if (actionType === 'move') {
      actions.push({ type: 'move', axis: 'x', speed: actionSpeed });
    } else if (actionType === 'dash') {
      actions.push({ type: 'dash', distance: 160, cooldown: 800 });
    } else if (actionType === 'gravity') {
      actions.push({ type: 'gravity', multiplier: 0.5 });
    }

    const conditions: SkillSchema['conditions'] = [];
    if (needsGround && actionType === 'jump') {
      conditions.push({ type: 'onGround' });
    }

    const skill: SkillSchema = {
      id: editing.id,
      name,
      trigger: { type: triggerType, key: triggerKey },
      actions,
      conditions: conditions.length ? conditions : undefined,
    };

    try {
      const existing = skills.find((s) => s.id === skill.id);
      if (existing && !existing.id.startsWith('skill_')) {
        await api.skills.update(skill.id, skill);
      } else if (!existing) {
        await api.skills.create(name, skill);
      }
      onRefresh();
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleSkill = (id: string) => {
    if (selectedSkillIds.includes(id)) {
      onSkillsChange(selectedSkillIds.filter((s) => s !== id));
    } else {
      onSkillsChange([...selectedSkillIds, id]);
    }
  };

  return (
    <div className="skill-builder">
      <h3>Habilidades</h3>
      <div className="skill-list">
        {skills.map((skill) => (
          <div key={skill.id} className="skill-item">
            <label>
              <input
                type="checkbox"
                checked={selectedSkillIds.includes(skill.id)}
                onChange={() => toggleSkill(skill.id)}
              />
              <span>
                {skill.name} — {skill.trigger.key} ({skill.trigger.type})
              </span>
            </label>
            {!skill.id.startsWith('skill_') && (
              <button className="retro-btn small" onClick={() => startEdit(skill)}>
                Editar
              </button>
            )}
          </div>
        ))}
      </div>

      <button className="retro-btn" onClick={startNew}>
        + Crear habilidad
      </button>

      {editing && (
        <div className="skill-form">
          <h4>{editing.id.startsWith('skill_') ? 'Editar preset' : 'Nueva habilidad'}</h4>
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} className="retro-input" />
          </label>
          <label>
            Tecla
            <select
              value={triggerKey}
              onChange={(e) => setTriggerKey(e.target.value)}
              className="retro-input"
            >
              {KEY_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo trigger
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as typeof triggerType)}
              className="retro-input"
            >
              <option value="keydown">Al presionar</option>
              <option value="hold">Mantener</option>
              <option value="keyup">Al soltar</option>
            </select>
          </label>
          <label>
            Acción
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="retro-input"
            >
              {ACTION_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          {actionType === 'jump' && (
            <>
              <label>
                Fuerza
                <input
                  type="number"
                  value={actionForce}
                  onChange={(e) => setActionForce(Number(e.target.value))}
                  className="retro-input"
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={needsGround}
                  onChange={(e) => setNeedsGround(e.target.checked)}
                />
                Solo en suelo
              </label>
            </>
          )}
          {actionType === 'move' && (
            <label>
              Velocidad
              <input
                type="number"
                value={actionSpeed}
                onChange={(e) => setActionSpeed(Number(e.target.value))}
                className="retro-input"
              />
            </label>
          )}
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
      )}
    </div>
  );
}
