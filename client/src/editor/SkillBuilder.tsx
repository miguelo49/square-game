import { useNavigate } from 'react-router-dom';
import type { SkillSchema } from '../types';

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

  const manage = onManage ?? (() => navigate('/skills'));

  return (
    <div className="skill-builder">
      <h3>Habilidades del nivel</h3>
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
