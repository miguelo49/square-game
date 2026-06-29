const BLOCKED_PATTERNS = [
  /\beval\b/i,
  /\bimport\b/i,
  /\bfetch\b/i,
  /\bwindow\b/i,
  /\bdocument\b/i,
  /\bFunction\b/,
  /\b__proto__\b/,
  /\bconstructor\b/,
];

interface SkillActionLike {
  type?: string;
  customName?: string;
  script?: string;
}

interface SkillDataLike {
  actions?: SkillActionLike[];
}

export function validateSkillData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return 'data inválido';
  const skill = data as SkillDataLike;
  if (!Array.isArray(skill.actions) || skill.actions.length === 0) {
    return 'La skill debe tener al menos una acción';
  }

  for (const action of skill.actions) {
    if (action.type === 'custom') {
      const name = action.customName?.trim();
      if (!name || name.length > 32) {
        return 'Acción personalizada requiere nombre (1–32 caracteres)';
      }
      const script = action.script?.trim();
      if (!script) return `Acción "${name}" requiere script`;
      if (script.length > 2048) return 'Script demasiado largo (máx 2048 caracteres)';
      for (const pat of BLOCKED_PATTERNS) {
        if (pat.test(script)) return 'Script contiene código no permitido';
      }
    }
  }

  return null;
}
