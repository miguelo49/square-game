import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { LevelSchema, AssetSchema, SkillSchema, MusicSchema } from '../types';
import { MusicPlayer } from '../audio/MusicPlayer';
import { paletteColor } from '../data/snesPalette';
import { migrateAssetAnimations } from '../game/utils/assetAnimations';

type Tab = 'levels' | 'assets' | 'music' | 'skills';

export function CommunityPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('levels');
  const [levels, setLevels] = useState<
    Array<{ id: string; name: string; data: LevelSchema; authorNickname: string }>
  >([]);
  const [assets, setAssets] = useState<
    Array<{ id: string; name: string; data: AssetSchema; authorNickname: string }>
  >([]);
  const [tracks, setTracks] = useState<
    Array<{ id: string; name: string; data: MusicSchema; authorNickname: string }>
  >([]);
  const [skills, setSkills] = useState<
    Array<{ id: string; name: string; data: SkillSchema; authorNickname: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const playerRef = useState(() => new MusicPlayer())[0];

  useEffect(() => {
    Promise.all([
      api.levels.listPublic(),
      api.assets.listPublic(),
      api.music.listPublic(),
      api.skills.listPublic(),
    ])
      .then(([lv, as, mu, sk]) => {
        setLevels(lv);
        setAssets(as);
        setTracks(mu);
        setSkills(sk);
      })
      .finally(() => setLoading(false));
    return () => playerRef.stop();
  }, [playerRef]);

  if (loading) return <div className="page loading">Cargando comunidad...</div>;

  return (
    <div className="community-page">
      <header className="page-header">
        <button className="retro-btn secondary" onClick={() => navigate('/')}>
          ← Menú
        </button>
        <h2>Comunidad</h2>
      </header>

      <div className="community-tabs">
        {(['levels', 'assets', 'music', 'skills'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`retro-btn small ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'levels'
              ? 'Niveles'
              : t === 'assets'
                ? 'Assets'
                : t === 'music'
                  ? 'Música'
                  : 'Skills'}
          </button>
        ))}
      </div>

      {tab === 'levels' && (
        <div className="community-list">
          {levels.length === 0 && <p className="empty-list">No hay niveles públicos</p>}
          {levels.map((l) => (
            <div key={l.id} className="community-card">
              <strong>{l.name}</strong>
              <span className="level-author">por {l.authorNickname}</span>
              <button
                className="retro-btn small"
                onClick={() => navigate('/play')}
              >
                Jugar
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'assets' && (
        <div className="community-grid">
          {assets.length === 0 && <p className="empty-list">No hay assets públicos</p>}
          {assets.map((a) => {
            const anim = migrateAssetAnimations(a.data);
            const px = anim.idle?.frames[0] ?? a.data.pixels;
            const slots = a.data.paletteSlots;
            return (
              <div key={a.id} className="community-asset-card">
                <canvas
                  width={a.data.width}
                  height={a.data.height}
                  className="asset-preview-canvas"
                  ref={(el) => {
                    if (!el || !px) return;
                    const ctx = el.getContext('2d')!;
                    ctx.clearRect(0, 0, el.width, el.height);
                    for (let y = 0; y < a.data.height; y++) {
                      for (let x = 0; x < a.data.width; x++) {
                        const idx = px[y * a.data.width + x] ?? 0;
                        if (idx === 0) continue;
                        ctx.fillStyle = paletteColor(slots[idx] ?? idx);
                        ctx.fillRect(x, y, 1, 1);
                      }
                    }
                  }}
                />
                <span>{a.name}</span>
                <span className="level-author">{a.authorNickname}</span>
                <button
                  className="retro-btn small"
                  onClick={() => navigate('/assets')}
                >
                  Ver en editor
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'music' && (
        <div className="community-list">
          {tracks.length === 0 && <p className="empty-list">No hay pistas públicas</p>}
          {tracks.map((t) => (
            <div key={t.id} className="community-card">
              <strong>{t.name}</strong>
              <span className="level-author">por {t.authorNickname}</span>
              <button
                className="retro-btn small"
                onClick={() => {
                  playerRef.stop();
                  void playerRef.playSchema(t.data);
                }}
              >
                ▶ Preview
              </button>
              <button
                className="retro-btn small"
                onClick={() => {
                  playerRef.stop();
                  navigate('/music');
                }}
              >
                Abrir hub
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'skills' && (
        <div className="community-list">
          {skills.length === 0 && <p className="empty-list">No hay skills públicas</p>}
          {skills.map((s) => (
            <div key={s.id} className="community-card">
              <strong>{s.data.name}</strong>
              <span>
                {s.data.trigger.key} · {s.data.actions.map((a) => a.type).join(', ')}
              </span>
              <span className="level-author">por {s.authorNickname}</span>
              <button
                className="retro-btn small"
                onClick={() => navigate('/skills')}
              >
                Ver en hub
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
