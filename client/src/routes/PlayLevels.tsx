import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { LevelSchema, LeaderboardEntry, RunResult } from '../types';
import { GameCanvas } from '../game/GameCanvas';
import { migrateLevel } from '../game/utils/placement';
import { useGameContent } from '../hooks/useGameContent';
import { useAuthStore } from '../store/authStore';
import { formatTimeMs } from '../utils/mergeContent';
import { renderLevelThumbnail } from '../utils/levelThumbnail';
import { LevelSocialPanel } from '../components/LevelSocialPanel';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';

type LevelTab = 'mine' | 'favorites';

type LevelItem = {
  id: string;
  name: string;
  data: LevelSchema;
  isDemo?: boolean;
  authorNickname?: string;
};

export function PlayLevels() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { assets, skills, musicTracks, loading: contentLoading } = useGameContent();
  const [tab, setTab] = useState<LevelTab>('mine');
  const [myLevels, setMyLevels] = useState<LevelItem[]>([]);
  const [favoriteLevels, setFavoriteLevels] = useState<LevelItem[]>([]);
  const [selected, setSelected] = useState<LevelSchema | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deaths, setDeaths] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [isPersonalBest, setIsPersonalBest] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myBest, setMyBest] = useState<{ timeMs: number; deaths: number } | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [levelMeta, setLevelMeta] = useState<{
    authorNickname?: string;
    playCount?: number;
    clearCount?: number;
    clearRate?: number;
    likeCount?: number;
    userLiked?: boolean;
    tags?: string[];
  }>({});
  const { message, show, dismiss } = useToast();

  const levels = tab === 'mine' ? myLevels : favoriteLevels;

  const loadLevels = useCallback(async () => {
    try {
      const [mine, fav] = await Promise.all([api.levels.list(), api.levels.listFavorites()]);
      setMyLevels(
        mine.map((l) => ({
          id: l.id,
          name: l.name,
          data: migrateLevel(l.data),
          isDemo: l.isDemo,
        }))
      );
      setFavoriteLevels(
        fav.map((l) => ({
          id: l.id,
          name: l.name,
          data: migrateLevel(l.data),
          isDemo: l.isDemo,
          authorNickname: l.authorNickname,
        }))
      );
      setFavoriteIds(new Set(fav.map((l) => l.id)));
    } catch (e) {
      show((e as Error).message);
    }
  }, [show]);

  const loadLevelMeta = useCallback(async (levelId: string) => {
    const [lb, me, meta] = await Promise.all([
      api.levels.leaderboard(levelId),
      api.levels.myScore(levelId),
      api.levels.get(levelId).catch(() => null),
    ]);
    setLeaderboard(lb);
    setMyBest(me.timeMs != null ? { timeMs: me.timeMs, deaths: me.deaths ?? 0 } : null);
    setIsFavorite(meta?.isFavorite ?? false);
    if (meta) {
      setLevelMeta({
        authorNickname: meta.authorNickname,
        playCount: meta.playCount,
        clearCount: meta.clearCount,
        clearRate: meta.clearRate,
        likeCount: meta.likeCount,
        userLiked: meta.userLiked,
        tags: meta.tags,
      });
    }
  }, []);

  useEffect(() => {
    loadLevels().finally(() => setLoading(false));
  }, [loadLevels]);

  const selectLevel = useCallback(
    (lvl: LevelItem) => {
      setSelected(migrateLevel(lvl.data));
      setSelectedId(lvl.id);
      setDeaths(0);
      setElapsedMs(0);
      setRunKey((k) => k + 1);
      setCompleted(false);
      setLastRun(null);
      setIsPersonalBest(false);
      setSidebarOpen(false);
      void api.levels.recordPlay(lvl.id).catch(() => {});
    },
    []
  );

  useEffect(() => {
    const qId = searchParams.get('level');
    if (qId) {
      const fromMine = myLevels.find((l) => l.id === qId);
      const fromFav = favoriteLevels.find((l) => l.id === qId);
      const hit = fromMine ?? fromFav;
      if (hit) {
        selectLevel(hit);
        return;
      }
      void api.levels.get(qId).then((meta) => {
        selectLevel({ id: meta.id, name: meta.name, data: migrateLevel(meta.data) });
      }).catch(() => show('Nivel no encontrado'));
      return;
    }
    if (myLevels.length > 0 && !selectedId) {
      selectLevel(myLevels[0]!);
    }
  }, [myLevels, favoriteLevels, searchParams, selectedId, selectLevel, show]);

  useEffect(() => {
    if (selectedId) void loadLevelMeta(selectedId);
  }, [selectedId, loadLevelMeta]);

  useEffect(() => {
    if (completed || !selected) return;
    const id = window.setInterval(() => setElapsedMs((e) => e + 50), 50);
    return () => clearInterval(id);
  }, [completed, selected, runKey]);

  const handleTabChange = (next: LevelTab) => {
    setTab(next);
    const list = next === 'mine' ? myLevels : favoriteLevels;
    if (list.length > 0) selectLevel(list[0]!);
    else {
      setSelected(null);
      setSelectedId(null);
    }
  };

  const activeSkills = useMemo(
    () => (selected ? skills.filter((s) => selected.skills.includes(s.id)) : []),
    [selected, skills]
  );

  const handleDeath = useCallback(() => setDeaths((d) => d + 1), []);

  const handleWin = useCallback(
    async (result: RunResult) => {
      setCompleted(true);
      setLastRun(result);
      setElapsedMs(result.timeMs);
      if (!selectedId) return;
      try {
        const res = await api.levels.submitScore(selectedId, result.timeMs, result.deaths);
        setIsPersonalBest(res.isPersonalBest);
        const [lb, me] = await Promise.all([
          api.levels.leaderboard(selectedId),
          api.levels.myScore(selectedId),
        ]);
        setLeaderboard(lb);
        if (me.timeMs != null) setMyBest({ timeMs: me.timeMs, deaths: me.deaths ?? 0 });
      } catch {
        /* optional */
      }
    },
    [selectedId]
  );

  const toggleFavorite = async (levelId?: string) => {
    const id = levelId ?? selectedId;
    if (!id) return;
    const res = await api.levels.favorite(id);
    if (id === selectedId) setIsFavorite(res.isFavorite);
    await loadLevels();
  };

  const replay = () => {
    if (!selectedId) return;
    const lvl = levels.find((l) => l.id === selectedId);
    if (lvl) selectLevel(lvl);
  };

  if (loading || contentLoading) {
    return <div className="page loading">Cargando...</div>;
  }

  return (
    <div className="play-page">
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
        <h2>Jugar Niveles</h2>
        <span className="speedrun-hud">
          {formatTimeMs(elapsedMs)} · Muertes: {deaths}
        </span>
      </header>

      {message && <Toast message={message} onDismiss={dismiss} />}

      {completed && lastRun && (
        <div className="win-banner win-banner-clear">
          ¡Nivel completado! {formatTimeMs(lastRun.timeMs)}
          {isPersonalBest && ' — ¡Nuevo récord personal!'}
        </div>
      )}

      <div className="play-layout">
        <aside className={`level-list ${sidebarOpen ? 'open' : ''}`}>
          <div className="community-banner">
            <button className="retro-btn small" onClick={() => navigate('/community?tab=levels')}>
              Explorar comunidad →
            </button>
          </div>

          <div className="level-tabs">
            <button
              className={`retro-btn small ${tab === 'mine' ? 'active' : ''}`}
              onClick={() => handleTabChange('mine')}
            >
              Mis niveles
            </button>
            <button
              className={`retro-btn small ${tab === 'favorites' ? 'active' : ''}`}
              onClick={() => handleTabChange('favorites')}
            >
              Favoritos ({favoriteLevels.length})
            </button>
          </div>

          <div className="level-list-scroll">
            {levels.length === 0 && (
              <p className="empty-list">
                {tab === 'mine'
                  ? 'No tienes niveles. Crea uno en el editor.'
                  : 'Sin favoritos — marca niveles con ☆ en comunidad.'}
              </p>
            )}

            {levels.map((lvl) => (
              <div
                key={lvl.id}
                className={`level-row ${selectedId === lvl.id ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className={`level-star-btn ${favoriteIds.has(lvl.id) ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleFavorite(lvl.id);
                  }}
                >
                  {favoriteIds.has(lvl.id) ? '★' : '☆'}
                </button>
                <button
                  type="button"
                  className={`retro-btn level-item ${selectedId === lvl.id ? 'active' : ''}`}
                  onClick={() => selectLevel(lvl)}
                >
                  <img
                    src={renderLevelThumbnail(lvl.data, 48, 28)}
                    alt=""
                    className="level-thumb"
                  />
                  {lvl.isDemo && <span className="demo-badge">DEMO</span>}
                  <span className="level-item-name">{lvl.name}</span>
                  {lvl.authorNickname && (
                    <span className="level-author"> — {lvl.authorNickname}</span>
                  )}
                </button>
              </div>
            ))}
          </div>

          {selectedId && (
            <div className="level-sidebar-meta">
              <button
                className={`retro-btn small favorite-btn ${isFavorite ? 'active' : ''}`}
                onClick={() => void toggleFavorite()}
              >
                {isFavorite ? '★ En favoritos' : '☆ Guardar nivel'}
              </button>
              <button
                className="retro-btn small"
                onClick={() => navigate(`/editor?level=${selectedId}`)}
              >
                Editar en editor
              </button>

              {myBest && (
                <p className="my-best">
                  Tu récord: {formatTimeMs(myBest.timeMs)} ({myBest.deaths} muertes)
                </p>
              )}

              <LevelSocialPanel
                levelId={selectedId}
                authorNickname={levelMeta.authorNickname}
                playCount={levelMeta.playCount}
                clearCount={levelMeta.clearCount}
                clearRate={levelMeta.clearRate}
                likeCount={levelMeta.likeCount}
                userLiked={levelMeta.userLiked}
                tags={levelMeta.tags}
                onMetaChange={() => void loadLevelMeta(selectedId)}
              />

              <h4>Top 20</h4>
              {leaderboard.length === 0 ? (
                <p className="empty-list">Sin tiempos aún</p>
              ) : (
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Jugador</th>
                      <th>Tiempo</th>
                      <th>Muertes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((e) => (
                      <tr
                        key={`${e.rank}-${e.nickname}`}
                        className={e.nickname === user?.nickname ? 'leaderboard-me' : ''}
                      >
                        <td>{e.rank}</td>
                        <td>{e.nickname}</td>
                        <td>{formatTimeMs(e.timeMs)}</td>
                        <td>{e.deaths}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </aside>

        <div className="game-panel">
          {selected ? (
            <>
              <GameCanvas
                key={runKey}
                level={selected}
                skills={activeSkills}
                assets={assets}
                musicTracks={musicTracks}
                mode="play"
                onDeath={handleDeath}
                onWin={(r) => void handleWin(r)}
              />
              {completed && (
                <div className="post-win-actions">
                  <button className="retro-btn" onClick={replay}>
                    Reintentar
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="play-empty-state">
              <p className="empty-list">
                {levels.length === 0
                  ? 'No hay niveles para jugar. Crea uno en el editor o explora la comunidad.'
                  : 'Selecciona un nivel de la lista.'}
              </p>
              {levels.length === 0 && (
                <div className="btn-row">
                  <button className="retro-btn" onClick={() => navigate('/editor')}>
                    Crear nivel
                  </button>
                  <button
                    className="retro-btn"
                    onClick={() => navigate('/community?tab=levels')}
                  >
                    Explorar comunidad
                  </button>
                </div>
              )}
              {levels.length > 0 && (
                <button
                  type="button"
                  className="retro-btn sidebar-toggle-mobile"
                  onClick={() => setSidebarOpen(true)}
                >
                  ☰ Ver lista de niveles
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}