interface PlatformPaletteProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
}

const TOOLS = [
  { id: 'select', label: 'Seleccionar', icon: '◎' },
  { id: 'platform', label: 'Plataforma', icon: '▬' },
  { id: 'enemy', label: 'Enemigo △', icon: '△' },
  { id: 'spawn', label: 'Spawn', icon: '★' },
  { id: 'portal', label: 'Portal', icon: '◎' },
  { id: 'delete', label: 'Borrar', icon: '✕' },
];

export function PlatformPalette({ activeTool, onToolChange }: PlatformPaletteProps) {
  return (
    <div className="platform-palette">
      <h3>Herramientas</h3>
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
      <p className="hint">
        Click para colocar. Arrastra objetos. Click derecho borra enemigo/plataforma.
        Flechas mueven cámara. Rueda = zoom.
      </p>
    </div>
  );
}
