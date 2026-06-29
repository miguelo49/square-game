import type { ReactNode } from 'react';

interface EditorSidebarProps {
  selectedEntityType: 'enemy' | 'platform' | '';
  toolsPanel: ReactNode;
  inspectorPanel: ReactNode;
  levelPanel: ReactNode;
  shortcutsPanel?: ReactNode;
  className?: string;
}

export function EditorSidebar({
  selectedEntityType,
  toolsPanel,
  inspectorPanel,
  levelPanel,
  shortcutsPanel,
  className = '',
}: EditorSidebarProps) {
  return (
    <aside className={`editor-sidebar editor-sidebar-split ${className}`.trim()}>
      <div className="editor-sidebar-tools">
        <h3 className="sidebar-section-title">Herramientas</h3>
        {toolsPanel}
        {shortcutsPanel}
      </div>

      {selectedEntityType ? (
        <div className="editor-sidebar-inspector">
          <h3 className="sidebar-section-title">
            Inspector {selectedEntityType === 'platform' ? '▬' : '△'}
          </h3>
          {inspectorPanel}
        </div>
      ) : (
        <div className="editor-sidebar-inspector inspector-empty">
          <p className="hint guide-steps">
            1) Coloca con ▬ · 2) Selecciona con ◎ · 3) Ajusta comportamiento
          </p>
        </div>
      )}

      <div className="editor-sidebar-level">
        <h3 className="sidebar-section-title">Nivel</h3>
        {levelPanel}
      </div>
    </aside>
  );
}
