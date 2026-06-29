import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type EditorSidebarTab = 'tools' | 'inspector' | 'level';

interface EditorSidebarProps {
  selectedEntityType: 'enemy' | 'platform' | '';
  toolsPanel: ReactNode;
  inspectorPanel: ReactNode;
  levelPanel: ReactNode;
}

const TABS: { id: EditorSidebarTab; label: string }[] = [
  { id: 'tools', label: 'Herramientas' },
  { id: 'inspector', label: 'Inspector' },
  { id: 'level', label: 'Nivel' },
];

export function EditorSidebar({
  selectedEntityType,
  toolsPanel,
  inspectorPanel,
  levelPanel,
}: EditorSidebarProps) {
  const [tab, setTab] = useState<EditorSidebarTab>('tools');

  useEffect(() => {
    if (selectedEntityType) setTab('inspector');
  }, [selectedEntityType]);

  return (
    <aside className="editor-sidebar">
      <div className="editor-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`retro-btn small editor-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'inspector' && selectedEntityType && (
              <span className="tab-badge">{selectedEntityType === 'platform' ? '▬' : '△'}</span>
            )}
          </button>
        ))}
      </div>

      <div className="editor-tab-panel">
        {tab === 'tools' && toolsPanel}
        {tab === 'inspector' && inspectorPanel}
        {tab === 'level' && levelPanel}
      </div>
    </aside>
  );
}
