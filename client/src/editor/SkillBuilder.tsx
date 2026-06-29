import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import type { SkillSchema } from '../types';
import { SKILL_PRESETS, clonePresetSkill } from '../data/skillPresets';
import { api } from '../api/client';

interface SkillBuilderProps {
  skills: SkillSchema[];
  selectedSkillIds: string[];
  onSkillsChange: (ids: string[]) => void;
  onRefresh: () => void;
  compact?: boolean;
  onManage?: () => void;
}

export function SkillBuilder({
  skills,
  selectedSkillIds,
  onSkillsChange,
  onRefresh,
  compact,
  onManage,
}: SkillBuilderProps) {
  const navigate = useNavigate();

  const toggleSkill = (id: string) => {
    if (selectedSkillIds.includes(id)) {
      onSkillsChange(selectedSkillIds.filter((s) => s !== id));
    } else {
      onSkillsChange([...selectedSkillIds, id]);
    }
  };

  const addPresetToLevel = async (presetId: string) => {
    const preset = SKILL_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    let skillId = preset.systemSkillId;
    if (skillId && skills.some((s) => s.id === skillId)) {
      if (!selectedSkillIds.includes(skillId)) {
        onSkillsChange([...selectedSkillIds, skillId]);
      }
      return;
    }

    const existing = skills.find(
      (s) => s.name === preset.skill.name && s.trigger.key === preset.skill.trigger.key
    );
    if (existing) {
      if (!selectedSkillIds.includes(existing.id)) {
        onSkillsChange([...selectedSkillIds, existing.id]);
      }
      return;
    }

    const draft = clonePresetSkill(preset, uuidv4());
    await api.skills.create(draft.name, draft);
    await onRefresh();
    onSkillsChange([...selectedSkillIds, draft.id]);
  };

  const manage = onManage ?? (() => navigate('/skills'));

  return (
    <div className="skill-builder">
      <h3>Habilidades del nivel</h3>

      <div className="skill-quick-presets">
        <span className="quick-label">Añadir rápido:</span>
        <div className="preset-chips">
          {SKILL_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="retro-btn small preset-chip"
              title={p.description}
              onClick={() => void addPresetToLevel(p.id)}
            >
              + {p.label}
            </button>
          ))}
        </div>
      </div>

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
                {skill.name} — {skill.trigger.key}
                {skill.animClip && (
                  <span className="skill-anim-tag"> [{skill.animClip}]</span>
                )}
              </span>
            </label>
          </div>
        ))}
      </div>
      <button className="retro-btn small" onClick={manage}>
        Gestionar biblioteca →
      </button>
      {!compact && (
        <p className="hint">Edita y crea habilidades en el hub de Habilidades del menú</p>
      )}
    </div>
  );
}
