import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import type { LevelSchema, SelectedEnemyConfig } from '../types';
import { DEFAULT_ENEMY_SELECTION } from '../game/entities/enemyRegistry';
import { GameCanvas } from '../game/GameCanvas';
import { PlatformPalette } from '../editor/PlatformPalette';
import { EnemyPalette } from '../editor/EnemyPalette';
import { EnemyInspector } from '../editor/EnemyInspector';
import { PropertyPanel } from '../editor/PropertyPanel';
import { SkillBuilder } from '../editor/SkillBuilder';
import { generateProceduralLevel, validateLevel } from '../generator/LevelGenerator';
import { downloadSqlevel, importSqlevel } from '../storage/compression';
import { migrateLevel } from '../game/utils/placement';
import { useGameContent } from '../hooks/useGameContent';

export function LevelEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const [level, setLevel] = useState<LevelSchema>(() => generateProceduralLevel());
  const [levelName, setLevelName] = useState('Mi Nivel');
  const [levelId, setLevelId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [editorTool, setEditorTool] = useState('platform');
  const [selectedEnemy, setSelectedEnemy] = useState<SelectedEnemyConfig>(DEFAULT_ENEMY_SELECTION);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'play'>('edit');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [completed, setCompleted] = useState(false);
  const { assets, skills, musicTracks, reload: reloadContent } = useGameContent();

  useEffect(() => {
    const key = levelId ?? 'draft';
    const raw = sessionStorage.getItem(`music-result-${key}`);
    if (!raw) return;
    sessionStorage.removeItem(`music-result-${key}`);
    const music = JSON.parse(raw) as LevelSchema['music'];
    setLevel((prev) => ({ ...prev, music }));
  }, [location.key, levelId]);

  const activeSkills = useMemo(
    () => skills.filter((s) => level.skills.includes(s.id)),
    [skills, level.skills]
  );

  const handleLevelChange = useCallback((updated: LevelSchema) => {
    setLevel(updated);
  }, []);

  const handleSave = async () => {
    const err = validateLevel(level);
    if (err) {
      setMessage(err);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const data = { ...level, name: levelName };
      if (levelId) {
        await api.levels.update(levelId, levelName, data);
        setMessage('Nivel guardado!');
      } else {
        const res = await api.levels.create(levelName, data);
        setLevelId(res.id);
        setMessage('Nivel creado!');
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!levelId) {
      setMessage('Guarda el nivel antes de compartir');
      return;
    }
    try {
      const res = await api.levels.share(levelId);
      setIsPublic(res.isPublic);
      setMessage(res.isPublic ? 'Nivel compartido en comunidad!' : 'Nivel ya no es público');
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const handleGenerate = () => {
    const seed = Math.floor(Math.random() * 999999);
    const generated = generateProceduralLevel(seed);
    setLevel(generated);
    setLevelName(generated.name);
    setLevelId(null);
    setMessage(`Generado con seed ${seed}`);
  };

  const handleExport = () => {
    downloadSqlevel({ ...level, name: levelName }, levelName.replace(/\s+/g, '_'));
    setMessage('Exportado como .sqlevel');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importSqlevel(file);
      setLevel(migrateLevel(imported));
      setLevelName(imported.name);
      setLevelId(null);
      setMessage('Nivel importado!');
    } catch {
      setMessage('Error al importar');
    }
  };

  const openMusicEditor = () => {
    const key = levelId ?? 'draft';
    sessionStorage.setItem(`music-level-${key}`, JSON.stringify(level));
    navigate(`/music/level?level=${key}`);
  };

  return (
    <div className="editor-page">
      <header className="page-header">
        <button className="retro-btn secondary" onClick={() => navigate('/')}>
          ← Menú
        </button>
        <h2>Editor de Nivel</h2>
        <div className="header-actions">
          <button
            className={`retro-btn ${mode === 'play' ? 'active' : ''}`}
            onClick={() => {
              setMode(mode === 'play' ? 'edit' : 'play');
              setCompleted(false);
            }}
          >
            {mode === 'play' ? '■ Stop' : '▶ Playtest'}
          </button>
          <button className="retro-btn" onClick={handleGenerate}>
            Generar
          </button>
          <button className="retro-btn" onClick={handleSave} disabled={saving}>
            {saving ? '...' : 'Guardar'}
          </button>
          {levelId && (
            <button className={`retro-btn ${isPublic ? 'active' : ''}`} onClick={handleShare}>
              {isPublic ? 'Dejar de compartir' : 'Compartir'}
            </button>
          )}
          <button className="retro-btn" onClick={handleExport}>
            Exportar
          </button>
          <label className="retro-btn file-label">
            Importar
            <input type="file" accept=".sqlevel" onChange={handleImport} hidden />
          </label>
        </div>
      </header>

      {message && <p className="toast">{message}</p>}
      {completed && mode === 'play' && (
        <div className="win-banner">Nivel completado! (playtest)</div>
      )}

      <div className="editor-layout">
        <aside className="editor-sidebar">
          <PlatformPalette activeTool={editorTool} onToolChange={setEditorTool} />
          <EnemyPalette
            assets={assets}
            selected={selectedEnemy}
            onChange={setSelectedEnemy}
          />
          <EnemyInspector
            enemies={level.enemies}
            selectedId={selectedEntityId}
            assets={assets}
            onSelect={setSelectedEntityId}
            onChange={(enemy) => {
              setLevel({
                ...level,
                enemies: level.enemies.map((e) => (e.id === enemy.id ? enemy : e)),
              });
            }}
            onClear={() => setSelectedEntityId(null)}
          />
          <PropertyPanel
            level={level}
            onChange={setLevel}
            levelName={levelName}
            onNameChange={setLevelName}
            onEditMusic={openMusicEditor}
            musicTracks={musicTracks}
          />
          <SkillBuilder
            compact
            skills={skills}
            selectedSkillIds={level.skills}
            onSkillsChange={(ids) => setLevel({ ...level, skills: ids })}
            onRefresh={reloadContent}
            onManage={() => navigate('/skills')}
          />
        </aside>

        <div className="game-panel editor-game">
          <GameCanvas
            level={level}
            skills={activeSkills}
            assets={assets}
            musicTracks={musicTracks}
            mode={mode}
            editorTool={editorTool}
            selectedEnemy={selectedEnemy}
            selectedEntityId={selectedEntityId}
            onLevelChange={handleLevelChange}
            onEditorSelect={(type, id) => {
              if (type === 'enemy' && id) setSelectedEntityId(id);
              else if (!type) setSelectedEntityId(null);
            }}
            onDeath={() => setMode('edit')}
            onWin={() => setCompleted(true)}
          />
        </div>
      </div>
    </div>
  );
}
