import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import type { AssetSchema, LevelSchema, SelectedEnemyConfig } from '../types';
import { DEFAULT_ENEMY_SELECTION } from '../game/entities/enemyRegistry';
import { GameCanvas } from '../game/GameCanvas';
import { PlatformPalette } from '../editor/PlatformPalette';
import { EnemyPalette } from '../editor/EnemyPalette';
import { EnemyInspector } from '../editor/EnemyInspector';
import { PlatformInspector } from '../editor/PlatformInspector';
import { PropertyPanel } from '../editor/PropertyPanel';
import { SkillBuilder } from '../editor/SkillBuilder';
import { EditorSidebar } from '../editor/EditorSidebar';
import { generateProceduralLevel, validateLevel } from '../generator/LevelGenerator';
import {
  downloadSqlevel,
  importSqlevel,
  embedLevelAssets,
  mergeEmbeddedAssets,
} from '../storage/compression';
import { migrateLevel } from '../game/utils/placement';
import { useGameContent } from '../hooks/useGameContent';
import { mergeById } from '../utils/mergeContent';

export function LevelEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const [level, setLevel] = useState<LevelSchema>(() => generateProceduralLevel());
  const [levelName, setLevelName] = useState('Mi Nivel');
  const [levelId, setLevelId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [editorTool, setEditorTool] = useState('platform');
  const [defaultPlatformPreset, setDefaultPlatformPreset] = useState('static');
  const [selectedEnemy, setSelectedEnemy] = useState<SelectedEnemyConfig>(DEFAULT_ENEMY_SELECTION);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<'enemy' | 'platform' | ''>('');
  const [extraAssets, setExtraAssets] = useState<AssetSchema[]>([]);
  const [mode, setMode] = useState<'edit' | 'play'>('edit');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [completed, setCompleted] = useState(false);
  const { assets, skills, musicTracks, reload: reloadContent } = useGameContent();

  const allAssets = useMemo(
    () => mergeById(assets, extraAssets),
    [assets, extraAssets]
  );

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

  const selectedPlatform = useMemo(
    () =>
      selectedEntityType === 'platform' && selectedEntityId
        ? level.platforms.find((p) => p.id === selectedEntityId) ?? null
        : null,
    [level.platforms, selectedEntityId, selectedEntityType]
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
      const data = embedLevelAssets({ ...level, name: levelName }, allAssets);
      if (levelId) {
        await api.levels.update(levelId, levelName, data);
        setMessage('Nivel guardado!');
      } else {
        const res = await api.levels.create(levelName, data);
        setLevelId(res.id);
        setMessage('Nivel guardado!');
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
    downloadSqlevel(
      embedLevelAssets({ ...level, name: levelName }, allAssets),
      levelName.replace(/\s+/g, '_')
    );
    setMessage('Exportado como .sqlevel (incluye assets embebidos)');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = migrateLevel(await importSqlevel(file));
      const { level: cleanLevel, mergedAssets, missingIds } = mergeEmbeddedAssets(
        imported,
        allAssets
      );
      setLevel(cleanLevel);
      setLevelName(imported.name);
      setLevelId(null);
      if (mergedAssets.length > extraAssets.length) {
        setExtraAssets((prev) => mergeById(prev, imported.embeddedAssets ?? []));
      }
      setMessage(
        missingIds.length
          ? `Importado. Faltan assets: ${missingIds.join(', ')}`
          : 'Nivel importado!'
      );
    } catch {
      setMessage('Error al importar');
    }
    e.target.value = '';
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
        <EditorSidebar
          selectedEntityType={selectedEntityType}
          toolsPanel={
            <>
              <PlatformPalette
                activeTool={editorTool}
                onToolChange={setEditorTool}
                defaultPlatformPreset={defaultPlatformPreset}
                onDefaultPresetChange={setDefaultPlatformPreset}
              />
              <EnemyPalette
                assets={allAssets}
                selected={selectedEnemy}
                onChange={setSelectedEnemy}
              />
            </>
          }
          inspectorPanel={
            selectedEntityType === 'platform' ? (
              <PlatformInspector
                platform={selectedPlatform}
                assets={allAssets}
                onChange={(platform) => {
                  setLevel({
                    ...level,
                    platforms: level.platforms.map((p) =>
                      p.id === platform.id ? platform : p
                    ),
                  });
                }}
                onClear={() => {
                  setSelectedEntityId(null);
                  setSelectedEntityType('');
                }}
              />
            ) : selectedEntityType === 'enemy' ? (
              <EnemyInspector
                enemies={level.enemies}
                selectedId={selectedEntityId}
                assets={allAssets}
                onSelect={(id) => {
                  setSelectedEntityType('enemy');
                  setSelectedEntityId(id);
                }}
                onChange={(enemy) => {
                  setLevel({
                    ...level,
                    enemies: level.enemies.map((e) => (e.id === enemy.id ? enemy : e)),
                  });
                }}
                onClear={() => {
                  setSelectedEntityId(null);
                  setSelectedEntityType('');
                }}
              />
            ) : (
              <div className="inspector-empty">
                <p className="hint">Selecciona una plataforma o enemigo con ◎</p>
              </div>
            )
          }
          levelPanel={
            <>
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
            </>
          }
        />

        <div className="game-panel editor-game">
          <GameCanvas
            level={level}
            skills={activeSkills}
            assets={assets}
            extraAssets={extraAssets}
            musicTracks={musicTracks}
            mode={mode}
            editorTool={editorTool}
            selectedEnemy={selectedEnemy}
            selectedEntityId={selectedEntityId}
            defaultPlatformPreset={defaultPlatformPreset}
            onLevelChange={handleLevelChange}
            onEditorSelect={(type, id) => {
              if (type === 'enemy' && id) {
                setSelectedEntityType('enemy');
                setSelectedEntityId(id);
              } else if (type === 'platform' && id) {
                setSelectedEntityType('platform');
                setSelectedEntityId(id);
              } else if (!type) {
                setSelectedEntityId(null);
                setSelectedEntityType('');
              }
            }}
            onDeath={() => setMode('edit')}
            onWin={() => setCompleted(true)}
          />
        </div>
      </div>
    </div>
  );
}
