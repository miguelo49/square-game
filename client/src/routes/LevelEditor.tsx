import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { AssetSchema, LevelSchema, SelectedEnemyConfig, EnemyDef, PlatformDef } from '../types';
import { DEFAULT_ENEMY_SELECTION } from '../game/entities/enemyRegistry';
import { GameCanvas } from '../game/GameCanvas';
import { PlatformPalette } from '../editor/PlatformPalette';
import { EnemyPalette } from '../editor/EnemyPalette';
import { EnemyInspector } from '../editor/EnemyInspector';
import { PlatformInspector } from '../editor/PlatformInspector';
import { PropertyPanel } from '../editor/PropertyPanel';
import { SkillBuilder } from '../editor/SkillBuilder';
import { EditorSidebar } from '../editor/EditorSidebar';
import { EditorStatusBar } from '../editor/EditorStatusBar';
import { LevelMinimap } from '../editor/LevelMinimap';
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
import { useLevelHistory } from '../hooks/useLevelHistory';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { MAX_PLATFORMS, MAX_ENEMIES } from '../data/retroLimits';
import { MusicEditor } from './MusicEditor';

const TOOL_KEYS = ['select', 'platform', 'enemy', 'spawn', 'portal', 'delete'] as const;
const PLAYTEST_DEATH_KEY = 'sq-playtest-on-death';

export function LevelEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initial = useMemo(() => generateProceduralLevel(), []);
  const {
    level,
    setLevel,
    setLevelDebounced,
    undo,
    redo,
    resetHistory,
  } = useLevelHistory(initial);
  const [levelName, setLevelName] = useState('Mi Nivel');
  const [levelId, setLevelId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [authorCleared, setAuthorCleared] = useState(false);
  const [levelTags, setLevelTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [editorTool, setEditorTool] = useState('platform');
  const [defaultPlatformPreset, setDefaultPlatformPreset] = useState('static');
  const [selectedEnemy, setSelectedEnemy] = useState<SelectedEnemyConfig>(DEFAULT_ENEMY_SELECTION);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<'enemy' | 'platform' | ''>('');
  const [extraAssets, setExtraAssets] = useState<AssetSchema[]>([]);
  const [mode, setMode] = useState<'edit' | 'play'>('edit');
  const [saving, setSaving] = useState(false);
  const { message, show, dismiss } = useToast();
  const [completed, setCompleted] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [savedLevels, setSavedLevels] = useState<
    Array<{ id: string; name: string; isDemo?: boolean; isPublic?: boolean }>
  >([]);
  const [showGrid, setShowGrid] = useState(true);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [playtestKey, setPlaytestKey] = useState(0);
  const [playtestDeaths, setPlaytestDeaths] = useState(0);
  const [musicModalOpen, setMusicModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const clipboardRef = useRef<{ type: 'enemy' | 'platform'; data: EnemyDef | PlatformDef } | null>(
    null
  );
  const { assets, skills, musicTracks, reload: reloadContent } = useGameContent();

  const allAssets = useMemo(() => mergeById(assets, extraAssets), [assets, extraAssets]);

  const loadSavedLevels = useCallback(async () => {
    const list = await api.levels.list();
    setSavedLevels(
      list.filter((l) => !l.isDemo).map((l) => ({
        id: l.id,
        name: l.name,
        isPublic: l.isPublic,
      }))
    );
  }, []);

  const loadLevelById = useCallback(
    async (id: string) => {
      const meta = await api.levels.get(id);
      resetHistory(migrateLevel(meta.data));
      setLevelName(meta.name);
      setLevelId(meta.id);
      setIsPublic(meta.isPublic ?? false);
      setAuthorCleared(meta.authorCleared ?? false);
      setLevelTags(meta.tags ?? []);
      setTagsInput((meta.tags ?? []).join(', '));
      setSelectedEntityId(null);
      setSelectedEntityType('');
      setMode('edit');
      setCompleted(false);
      show(`Nivel "${meta.name}" cargado`);
    },
    [resetHistory, show]
  );

  useEffect(() => {
    void loadSavedLevels();
  }, [loadSavedLevels]);

  useEffect(() => {
    const qLevel = searchParams.get('level');
    if (qLevel) void loadLevelById(qLevel);
  }, [searchParams, loadLevelById]);

  useEffect(() => {
    const key = levelId ?? 'draft';
    const raw = sessionStorage.getItem(`music-result-${key}`);
    if (!raw) return;
    sessionStorage.removeItem(`music-result-${key}`);
    const music = JSON.parse(raw) as LevelSchema['music'];
    setLevel({ ...level, music });
  }, [location.key, levelId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleLevelChange = useCallback(
    (updated: LevelSchema) => {
      setLevelDebounced(updated);
    },
    [setLevelDebounced]
  );

  const handleSave = async () => {
    const err = validateLevel(level);
    if (err) {
      show(err);
      return;
    }
    setSaving(true);
    try {
      const data = embedLevelAssets({ ...level, name: levelName }, allAssets);
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8);
      if (levelId) {
        await api.levels.update(levelId, levelName, data, tags);
        setLevelTags(tags);
        show('Nivel guardado!');
      } else {
        const res = await api.levels.create(levelName, data);
        setLevelId(res.id);
        show('Nivel guardado!');
      }
      await loadSavedLevels();
    } catch (e) {
      show((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!levelId) {
      show('Guarda el nivel antes de compartir');
      return;
    }
    if (!authorCleared) {
      show('Completa el playtest antes de compartir');
      return;
    }
    try {
      const res = await api.levels.share(levelId);
      setIsPublic(res.isPublic);
      show(res.isPublic ? 'Nivel compartido en comunidad!' : 'Nivel ya no es público');
    } catch (e) {
      show((e as Error).message);
    }
  };

  const handleGenerate = () => {
    if (!window.confirm('¿Generar nivel aleatorio? Se perderán los cambios no guardados.')) return;
    const seed = Math.floor(Math.random() * 999999);
    const generated = generateProceduralLevel(seed);
    resetHistory(generated);
    setLevelName(generated.name);
    setLevelId(null);
    setIsPublic(false);
    setAuthorCleared(false);
    setLevelTags([]);
    setTagsInput('');
    show(`Generado con seed ${seed}`);
  };

  const handleNewLevel = () => {
    if (!window.confirm('¿Crear nivel nuevo? Se perderán los cambios no guardados.')) return;
    const blank = generateProceduralLevel();
    blank.platforms = blank.platforms.slice(0, 1);
    blank.enemies = [];
    resetHistory(blank);
    setLevelName('Mi Nivel');
    setLevelId(null);
    setIsPublic(false);
    setAuthorCleared(false);
    setLevelTags([]);
    setTagsInput('');
    show('Nuevo borrador');
  };

  const handleExport = () => {
    downloadSqlevel(
      embedLevelAssets({ ...level, name: levelName }, allAssets),
      levelName.replace(/\s+/g, '_')
    );
    show('Exportado como .sqlevel');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = migrateLevel(await importSqlevel(file));
      const { level: cleanLevel, missingIds } = mergeEmbeddedAssets(imported, allAssets);
      resetHistory(cleanLevel);
      setLevelName(imported.name);
      setLevelId(null);
      setAuthorCleared(false);
      if (imported.embeddedAssets?.length) {
        setExtraAssets((prev) => mergeById(prev, imported.embeddedAssets ?? []));
      }
      show(
        missingIds.length
          ? `Importado. Faltan assets: ${missingIds.join(', ')}`
          : 'Nivel importado!'
      );
    } catch {
      show('Error al importar');
    }
    e.target.value = '';
  };

  const duplicateSelection = useCallback(() => {
    if (!selectedEntityId || !selectedEntityType) return;
    if (selectedEntityType === 'enemy') {
      const e = level.enemies.find((en) => en.id === selectedEntityId);
      if (!e) return;
      const copy: EnemyDef = {
        ...e,
        id: `e-${Date.now()}`,
        x: e.x + 32,
        y: e.y,
      };
      setLevel({ ...level, enemies: [...level.enemies, copy] });
    } else {
      const p = level.platforms.find((pl) => pl.id === selectedEntityId);
      if (!p) return;
      const copy: PlatformDef = {
        ...p,
        id: `p-${Date.now()}`,
        x: p.x + 32,
        y: p.y,
      };
      setLevel({ ...level, platforms: [...level.platforms, copy] });
    }
    show('Entidad duplicada');
  }, [level, selectedEntityId, selectedEntityType, setLevel, show]);

  const deleteSelection = useCallback(() => {
    if (!selectedEntityId || !selectedEntityType) return;
    if (selectedEntityType === 'enemy') {
      setLevel({
        ...level,
        enemies: level.enemies.filter((e) => e.id !== selectedEntityId),
      });
    } else {
      setLevel({
        ...level,
        platforms: level.platforms.filter((p) => p.id !== selectedEntityId),
      });
    }
    setSelectedEntityId(null);
    setSelectedEntityType('');
  }, [level, selectedEntityId, selectedEntityType, setLevel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode === 'play') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key >= '1' && e.key <= '6') {
        const idx = Number(e.key) - 1;
        if (TOOL_KEYS[idx]) setEditorTool(TOOL_KEYS[idx]!);
        return;
      }
      if (e.key === 'Escape') {
        setSelectedEntityId(null);
        setSelectedEntityType('');
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection();
        return;
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (e.ctrlKey && e.key === 'c' && selectedEntityId && selectedEntityType) {
        if (selectedEntityType === 'enemy') {
          const en = level.enemies.find((x) => x.id === selectedEntityId);
          if (en) clipboardRef.current = { type: 'enemy', data: { ...en } };
        } else {
          const pl = level.platforms.find((x) => x.id === selectedEntityId);
          if (pl) clipboardRef.current = { type: 'platform', data: { ...pl } };
        }
        return;
      }
      if (e.ctrlKey && e.key === 'v' && clipboardRef.current) {
        const clip = clipboardRef.current;
        if (clip.type === 'enemy') {
          const d = clip.data as EnemyDef;
          setLevel({
            ...level,
            enemies: [
              ...level.enemies,
              { ...d, id: `e-${Date.now()}`, x: d.x + 32, y: d.y },
            ],
          });
        } else {
          const d = clip.data as PlatformDef;
          setLevel({
            ...level,
            platforms: [
              ...level.platforms,
              { ...d, id: `p-${Date.now()}`, x: d.x + 32, y: d.y },
            ],
          });
        }
        show('Pegado');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, undo, redo, deleteSelection, duplicateSelection, level, selectedEntityId, selectedEntityType, setLevel, show]);

  const onDeathPlaytest = useCallback(() => {
    setPlaytestDeaths((d) => d + 1);
    const pref = localStorage.getItem(PLAYTEST_DEATH_KEY) ?? 'restart';
    if (pref === 'edit') {
      setMode('edit');
    } else {
      setPlaytestKey((k) => k + 1);
    }
  }, []);

  const onWinPlaytest = useCallback(async () => {
    setCompleted(true);
    setAuthorCleared(true);
    if (levelId) {
      try {
        await api.levels.clearTest(levelId);
      } catch {
        /* draft */
      }
    }
  }, [levelId]);

  const restartPlaytest = () => {
    setPlaytestKey((k) => k + 1);
    setPlaytestDeaths(0);
    setCompleted(false);
  };

  return (
    <div className="editor-page">
      <header className="page-header">
        <button className="retro-btn secondary" onClick={() => navigate('/')}>
          ← Menú
        </button>
        <button
          type="button"
          className="retro-btn secondary sidebar-toggle"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          ☰
        </button>
        <h2>Editor de Nivel</h2>
        <div className="level-status-badges">
          <span className={`status-badge ${levelId ? 'saved' : 'draft'}`}>
            {levelId ? `Guardado · ${levelId.slice(0, 8)}` : 'Borrador'}
          </span>
          {levelId && (
            <span className={`status-badge ${isPublic ? 'public' : 'private'}`}>
              {isPublic ? 'Público' : 'Privado'}
            </span>
          )}
          {authorCleared && <span className="status-badge saved">Clear test ✓</span>}
        </div>
        <div className="header-actions">
          <button className="retro-btn" onClick={() => setShowOpen(true)}>
            Abrir
          </button>
          <button className="retro-btn" onClick={handleNewLevel}>
            Nuevo
          </button>
          <button
            className={`retro-btn ${mode === 'play' ? 'active' : ''}`}
            onClick={() => {
              if (mode === 'play') {
                setMode('edit');
              } else {
                setMode('play');
                setCompleted(false);
                setPlaytestDeaths(0);
                setPlaytestKey((k) => k + 1);
              }
            }}
          >
            {mode === 'play' ? '■ Stop' : '▶ Playtest'}
          </button>
          {mode === 'play' && (
            <button className="retro-btn" onClick={restartPlaytest}>
              Reiniciar
            </button>
          )}
          <button className="retro-btn" onClick={handleGenerate}>
            Generar
          </button>
          <button className="retro-btn" onClick={() => void handleSave()} disabled={saving}>
            {saving ? '...' : 'Guardar'}
          </button>
          {levelId && (
            <button
              className={`retro-btn ${isPublic ? 'active' : ''}`}
              onClick={() => void handleShare()}
              title={authorCleared ? 'Compartir en comunidad' : 'Completa el playtest primero'}
              disabled={!authorCleared && !isPublic}
            >
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

      {message && <Toast message={message} onDismiss={dismiss} />}
      {completed && mode === 'play' && (
        <div className="win-banner win-banner-playtest">
          Playtest completado! Puedes compartir tras guardar.
        </div>
      )}

      {showOpen && (
        <div className="music-modal-backdrop" onClick={() => setShowOpen(false)}>
          <div className="onboarding-box" onClick={(e) => e.stopPropagation()}>
            <h3>Abrir nivel</h3>
            <div className="track-list">
              {savedLevels.length === 0 && (
                <p className="empty-list">No tienes niveles guardados</p>
              )}
              {savedLevels.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="retro-btn small"
                  style={{ width: '100%', marginBottom: 4 }}
                  onClick={() => {
                    setShowOpen(false);
                    void loadLevelById(l.id);
                  }}
                >
                  {l.name} {l.isPublic ? '★' : ''}
                </button>
              ))}
            </div>
            <button className="retro-btn" onClick={() => setShowOpen(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {musicModalOpen && (
        <div className="music-modal-backdrop" onClick={() => setMusicModalOpen(false)}>
          <div className="music-modal" onClick={(e) => e.stopPropagation()}>
            <header className="page-header">
              <h2>Música del nivel</h2>
              <button className="retro-btn" onClick={() => setMusicModalOpen(false)}>
                Cerrar
              </button>
            </header>
            <MusicEditor
              embedded
              initialLevel={level}
              onSave={(music) => {
                setLevel({ ...level, music, musicTrackId: undefined, musicSeed: undefined });
                setMusicModalOpen(false);
                show('Música actualizada');
              }}
            />
          </div>
        </div>
      )}

      <div className="editor-layout">
        <EditorSidebar
          className={sidebarOpen ? 'open' : ''}
          selectedEntityType={selectedEntityType}
          shortcutsPanel={
            <details className="shortcuts-panel">
              <summary>Atajos de teclado</summary>
              <p>1-6 herramientas · Del borrar · Esc deseleccionar</p>
              <p>Ctrl+Z undo · Ctrl+Y redo · Ctrl+D duplicar</p>
              <p>Ctrl+C / Ctrl+V copiar y pegar</p>
              <label>
                Al morir en playtest
                <select
                  className="retro-input"
                  defaultValue={localStorage.getItem(PLAYTEST_DEATH_KEY) ?? 'restart'}
                  onChange={(e) => localStorage.setItem(PLAYTEST_DEATH_KEY, e.target.value)}
                >
                  <option value="restart">Reiniciar run</option>
                  <option value="edit">Volver a editar</option>
                </select>
              </label>
            </details>
          }
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
            ) : null
          }
          levelPanel={
            <>
              <PropertyPanel
                level={level}
                assets={allAssets}
                onChange={setLevel}
                levelName={levelName}
                onNameChange={setLevelName}
                onEditMusic={() => setMusicModalOpen(true)}
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
              {levelId && (
                <label className="tags-field">
                  Tags (coma, max 8)
                  <input
                    className="retro-input"
                    value={tagsInput}
                    placeholder="platformer, difícil, speedrun"
                    onChange={(e) => setTagsInput(e.target.value)}
                    onBlur={() => {
                      const tags = tagsInput
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .slice(0, 8);
                      setTagsInput(tags.join(', '));
                      if (levelId && tags.join(',') !== levelTags.join(',')) {
                        void api.levels
                          .update(levelId, levelName, level, tags)
                          .then(() => setLevelTags(tags));
                      }
                    }}
                  />
                </label>
              )}
            </>
          }
        />

        <div className="game-panel editor-game">
          {mode === 'play' && <div className="playtest-overlay">PLAYTEST · Muertes: {playtestDeaths}</div>}
          <GameCanvas
            key={mode === 'play' ? `play-${playtestKey}` : 'edit'}
            level={level}
            skills={activeSkills}
            assets={assets}
            extraAssets={extraAssets}
            musicTracks={musicTracks}
            mode={mode}
            playtest={mode === 'play'}
            editorTool={editorTool}
            selectedEnemy={selectedEnemy}
            selectedEntityId={selectedEntityId}
            defaultPlatformPreset={defaultPlatformPreset}
            showGrid={showGrid}
            onLevelChange={handleLevelChange}
            onCursorMove={(x, y) => setCursor({ x, y })}
            onCameraChange={(x, y, zoom) => setCamera({ x, y, zoom })}
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
            onDeath={onDeathPlaytest}
            onWin={() => void onWinPlaytest()}
          />
          {mode === 'edit' && (
            <>
              <LevelMinimap
                level={level}
                cameraX={camera.x}
                cameraY={camera.y}
                viewW={800}
                viewH={600}
                zoom={camera.zoom}
                onPan={(x, y) => setCamera((c) => ({ ...c, x: x - 400, y: y - 300 }))}
              />
              <EditorStatusBar
                tool={editorTool}
                cursorX={cursor.x}
                cursorY={cursor.y}
                zoom={camera.zoom}
                platformCount={level.platforms.length}
                enemyCount={level.enemies.length}
                maxPlatforms={MAX_PLATFORMS}
                maxEnemies={MAX_ENEMIES}
                showGrid={showGrid}
                onToggleGrid={() => setShowGrid((g) => !g)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
