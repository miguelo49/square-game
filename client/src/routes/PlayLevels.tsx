import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { LevelSchema, SkillSchema, AssetSchema } from '../types';
import { GameCanvas } from '../game/GameCanvas';
import { migrateLevel } from '../game/utils/placement';

type LevelTab = 'mine' | 'community';

type LevelItem = {
  id: string;
  name: string;
  data: LevelSchema;
  isDemo?: boolean;
  authorNickname?: string;
};

export function PlayLevels() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<LevelTab>('mine');
  const [myLevels, setMyLevels] = useState<LevelItem[]>([]);
  const [publicLevels, setPublicLevels] = useState<LevelItem[]>([]);
  const [skills, setSkills] = useState<SkillSchema[]>([]);
  const [assets, setAssets] = useState<AssetSchema[]>([]);
  const [selected, setSelected] = useState<LevelSchema | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deaths, setDeaths] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const levels = tab === 'mine' ? myLevels : publicLevels;

  useEffect(() => {
    Promise.all([
      api.levels.list(),
      api.levels.listPublic(),
      api.skills.list(),
      api.assets.list(),
    ])
      .then(([mine, pub, sk, as]) => {
        const mineItems: LevelItem[] = mine.map((l) => ({
          id: l.id,
          name: l.name,
          data: l.data,
          isDemo: l.isDemo,
        }));
        const pubItems: LevelItem[] = pub.map((l) => ({
          id: l.id,
          name: l.name,
          data: l.data,
          authorNickname: l.authorNickname,
        }));
        setMyLevels(mineItems);
        setPublicLevels(pubItems);
        setSkills(sk.map((s) => s.data));
        setAssets(as.map((a) => a.data));
        if (mineItems.length > 0) {
          setSelected(migrateLevel(mineItems[0]!.data));
          setSelectedId(mineItems[0]!.id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const selectLevel = useCallback((lvl: LevelItem) => {
    setSelected(migrateLevel(lvl.data));
    setSelectedId(lvl.id);
    setDeaths(0);
    setCompleted(false);
  }, []);

  const handleTabChange = (next: LevelTab) => {
    setTab(next);
    const list = next === 'mine' ? myLevels : publicLevels;
    if (list.length > 0) {
      selectLevel(list[0]!);
    } else {
      setSelected(null);
      setSelectedId(null);
    }
  };

  const activeSkills = useMemo(
    () => (selected ? skills.filter((s) => selected.skills.includes(s.id)) : []),
    [selected, skills]
  );

  const handleDeath = useCallback(() => setDeaths((d) => d + 1), []);
  const handleWin = useCallback(() => setCompleted(true), []);

  if (loading) return <div className="page loading">Cargando...</div>;

  return (
    <div className="play-page">
      <header className="page-header">
        <button className="retro-btn secondary" onClick={() => navigate('/')}>
          ← Menú
        </button>
        <h2>Jugar Niveles</h2>
        <span className="deaths">Muertes: {deaths}</span>
      </header>

      {completed && <div className="win-banner">Nivel completado!</div>}

      <div className="play-layout">
        <aside className="level-list">
          <div className="level-tabs">
            <button
              className={`retro-btn small ${tab === 'mine' ? 'active' : ''}`}
              onClick={() => handleTabChange('mine')}
            >
              Mis niveles
            </button>
            <button
              className={`retro-btn small ${tab === 'community' ? 'active' : ''}`}
              onClick={() => handleTabChange('community')}
            >
              Comunidad
            </button>
          </div>

          {levels.length === 0 && (
            <p className="empty-list">
              {tab === 'mine' ? 'No tienes niveles aún.' : 'No hay niveles públicos.'}
            </p>
          )}

          {levels.map((lvl) => (
            <button
              key={lvl.id}
              className={`retro-btn level-item ${selectedId === lvl.id ? 'active' : ''}`}
              onClick={() => selectLevel(lvl)}
            >
              {lvl.isDemo && '★ '}
              {lvl.name}
              {lvl.authorNickname && (
                <span className="level-author"> — {lvl.authorNickname}</span>
              )}
            </button>
          ))}
        </aside>

        <div className="game-panel">
          {selected && (
            <GameCanvas
              level={selected}
              skills={activeSkills}
              assets={assets}
              mode="play"
              onDeath={handleDeath}
              onWin={handleWin}
            />
          )}
        </div>
      </div>
    </div>
  );
}
