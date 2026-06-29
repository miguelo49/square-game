interface PlatformPaletteProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  defaultPlatformPreset: string;
  onDefaultPresetChange: (presetId: string) => void;
}

const TOOLS = [
  { id: 'select', label: 'Seleccionar', icon: '◎' },
  { id: 'platform', label: 'Plataforma', icon: '▬' },
  { id: 'enemy', label: 'Enemigo △', icon: '△' },
  { id: 'spawn', label: 'Spawn', icon: '★' },
  { id: 'portal', label: 'Portal', icon: '◉' },
  { id: 'delete', label: 'Borrar', icon: '✕' },
];

const PLACE_PRESETS = [
  { id: 'static', label: 'Estática' },
  { id: 'elevator', label: 'Ascensor' },
  { id: 'crumbling', label: 'Desmorona' },
  { id: 'conveyor', label: 'Cinta' },
];

const EXTRA_TOOLS = [
  { id: 'coin', label: 'Moneda ○', icon: '○' },
  { id: 'checkpoint', label: 'Checkpoint', icon: '⚑' },
  { id: 'decoration', label: 'Decoración', icon: '✦' },
  { id: 'hazard', label: 'Trampa', icon: '▲' },
];

export function PlatformPalette({
  activeTool,
  onToolChange,
  defaultPlatformPreset,
  onDefaultPresetChange,
}: PlatformPaletteProps) {
  return (
    <div className="platform-palette">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          className={`retro-btn palette-btn ${activeTool === tool.id ? 'active' : ''}`}
          onClick={() => onToolChange(tool.id)}
        >
          <span className="tool-icon">{tool.icon}</span>
          {tool.label}
        </button>
      ))}

      {EXTRA_TOOLS.map((tool) => (
        <button
          key={tool.id}
          className={`retro-btn palette-btn ${activeTool === tool.id ? 'active' : ''}`}
          onClick={() => onToolChange(tool.id)}
        >
          <span className="tool-icon">{tool.icon}</span>
          {tool.label}
        </button>
      ))}

      <label className="default-preset-label">
        Comportamiento al colocar ▬
        <select
          className="retro-input"
          value={defaultPlatformPreset}
          onChange={(e) => onDefaultPresetChange(e.target.value)}
        >
          {PLACE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <p className="hint">
        Click coloca · Arrastra mueve · Click der. borra · Flechas cámara
      </p>
    </div>
  );
}
