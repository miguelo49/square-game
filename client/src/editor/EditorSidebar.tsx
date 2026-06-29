import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type EditorSidebarTab = 'tools' | 'inspector' | 'level';

interface EditorSidebarProps {
  selectedEntityType: 'enemy' | 'platform' | '';
  toolsPanel: ReactNode;
  inspectorPanel: ReactNode;
  levelPanel: ReactNode;
}

const TABS: {
  id: EditorSidebarTab;
  label: string;
  icon: string;
  title: string;
}[] = [
  { id: 'tools', label: 'Herramientas', icon: '◈', title: 'Herramientas de edición' },
  { id: 'inspector', label: 'Inspector', icon: '▣', title: 'Inspector de entidad' },
  { id: 'level', label: 'Nivel', icon: '☰', title: 'Propiedades del nivel' },
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
            title={t.title}
            className={`retro-btn small editor-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="editor-tab-icon">{t.icon}</span>
            <span className="editor-tab-label">{t.label}</span>
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
