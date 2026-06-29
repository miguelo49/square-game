interface EditorStatusBarProps {
  tool: string;
  cursorX: number;
  cursorY: number;
  zoom: number;
  platformCount: number;
  enemyCount: number;
  maxPlatforms: number;
  maxEnemies: number;
  showGrid: boolean;
  onToggleGrid: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  select: 'Seleccionar',
  platform: 'Plataforma',
  enemy: 'Enemigo',
  spawn: 'Spawn',
  portal: 'Portal',
  delete: 'Borrar',
  coin: 'Moneda',
  checkpoint: 'Checkpoint',
  decoration: 'Decoración',
  hazard: 'Trampa',
};

export function EditorStatusBar({
  tool,
  cursorX,
  cursorY,
  zoom,
  platformCount,
  enemyCount,
  maxPlatforms,
  maxEnemies,
  showGrid,
  onToggleGrid,
}: EditorStatusBarProps) {
  const platWarn = platformCount >= maxPlatforms * 0.9;
  const enemyWarn = enemyCount >= maxEnemies * 0.9;

  return (
    <div className="editor-status-bar">
      <span>Herramienta: {TOOL_LABELS[tool] ?? tool}</span>
      <span>
        ({Math.round(cursorX)}, {Math.round(cursorY)})
      </span>
      <span>Zoom: {zoom.toFixed(1)}x</span>
      <span className={platWarn ? 'warn' : ''}>
        ▬ {platformCount}/{maxPlatforms}
      </span>
      <span className={enemyWarn ? 'warn' : ''}>
        △ {enemyCount}/{maxEnemies}
      </span>
      <button type="button" className="retro-btn small" onClick={onToggleGrid}>
        Grid {showGrid ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
