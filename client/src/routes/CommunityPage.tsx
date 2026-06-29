import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { LevelSchema, AssetSchema, SkillSchema, MusicSchema } from '../types';
import { MusicPlayer } from '../audio/MusicPlayer';
import { paletteColor } from '../data/snesPalette';
import { migrateAssetAnimations } from '../game/utils/assetAnimations';
import { renderLevelThumbnail } from '../utils/levelThumbnail';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';

type Tab = 'levels' | 'assets' | 'music' | 'skills';

export function CommunityPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(tabParam ?? 'levels');
  const [levels, setLevels] = useState<
    Array<{
      id: string;
      name: string;
      data: LevelSchema;
      authorNickname: string;
      playCount?: number;
      clearCount?: number;
      clearRate?: number;
      likeCount?: number;
      userLiked?: boolean;
      tags?: string[];
    }>
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
  const [sort, setSort] = useState<'recent' | 'popular' | 'likes'>('recent');
  const playerRef = useState(() => new MusicPlayer())[0];
  const { message, show, dismiss } = useToast();

  useEffect(() => {
    if (tabParam && ['levels', 'assets', 'music', 'skills'].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [tabParam]);

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

  const cloneAsset = async (id: string) => {
    try {
      const res = await api.assets.clone(id);
      show(`Asset "${res.name}" copiado a tu biblioteca`);
      navigate(`/assets?id=${res.id}`);
    } catch (e) {
      show((e as Error).message);
    }
  };

  const cloneMusic = async (id: string) => {
    try {
      const res = await api.music.clone(id);
      show(`Pista "${res.name}" copiada`);
      navigate(`/music?id=${res.id}`);
    } catch (e) {
      show((e as Error).message);
    }
  };

  const cloneSkill = async (id: string) => {
    try {
      const res = await api.skills.clone(id);
      show(`Skill "${res.name}" copiada`);
      navigate(`/skills?id=${res.id}`);
    } catch (e) {
      show((e as Error).message);
    }
  };

  const sortedLevels = [...levels].sort((a, b) => {
    if (sort === 'popular') return (b.playCount ?? 0) - (a.playCount ?? 0);
    if (sort === 'likes') return (b.likeCount ?? 0) - (a.likeCount ?? 0);
    return 0;
  });

  const toggleLike = async (id: string) => {
    try {
      const res = await api.levels.like(id);
      setLevels((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                userLiked: res.liked,
                likeCount: (l.likeCount ?? 0) + (res.liked ? 1 : -1),
              }
            : l
        )
      );
    } catch (e) {
      show((e as Error).message);
    }
  };

  if (loading) return <div className="page loading">Cargando comunidad...</div>;

  return (
    <div className="community-page">
      <header className="page-header">
        <button className="retro-btn secondary" onClick={() => navigate('/')}>
          ← Menú
        </button>
        <h2>Comunidad</h2>
        <span className="hint">Explora niveles, assets, música y skills públicos</span>
      </header>

      {message && <Toast message={message} onDismiss={dismiss} />}

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
        <>
          <div className="community-sort">
            <span className="hint">Ordenar:</span>
            {(['recent', 'popular', 'likes'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`retro-btn small ${sort === s ? 'active' : ''}`}
                onClick={() => setSort(s)}
              >
                {s === 'recent' ? 'Recientes' : s === 'popular' ? 'Populares' : 'Más likes'}
              </button>
            ))}
          </div>
          <div className="community-list">
            {sortedLevels.length === 0 && <p className="empty-list">No hay niveles públicos</p>}
            {sortedLevels.map((l) => (
              <div key={l.id} className="community-card">
                <img
                  src={renderLevelThumbnail(l.data)}
                  alt=""
                  className="level-thumb"
                  width={140}
                  height={80}
                />
                <strong>{l.name}</strong>
                <span className="level-author">
                  por{' '}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => navigate(`/user/${encodeURIComponent(l.authorNickname)}`)}
                  >
                    {l.authorNickname}
                  </button>
                </span>
                <span className="level-stats-row">
                  {l.playCount ?? 0} plays · {l.clearRate ?? 0}% clear · ♥ {l.likeCount ?? 0}
                </span>
                {(l.tags?.length ?? 0) > 0 && (
                  <div className="level-tags">
                    {l.tags!.map((t) => (
                      <span key={t} className="tag-chip">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="btn-row">
                  <button
                    className="retro-btn small"
                    onClick={() => navigate(`/play?level=${l.id}`)}
                  >
                    Jugar
                  </button>
                  <button
                    type="button"
                    className={`retro-btn small like-btn ${l.userLiked ? 'active' : ''}`}
                    onClick={() => void toggleLike(l.id)}
                  >
                    {l.userLiked ? '♥' : '♡'}
                  </button>
                  <button
                    className="retro-btn small"
                    onClick={() => navigate(`/editor?level=${l.id}`)}
                  >
                    Abrir en editor
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
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
                  onClick={() => navigate(`/assets?id=${a.id}`)}
                >
                  Ver en editor
                </button>
                <button
                  className="retro-btn small"
                  onClick={() => void cloneAsset(a.id)}
                >
                  Usar en mi biblioteca
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
                onClick={() => navigate(`/music?id=${t.id}`)}
              >
                Abrir hub
              </button>
              <button
                className="retro-btn small"
                onClick={() => void cloneMusic(t.id)}
              >
                Usar en mi biblioteca
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
                onClick={() => navigate(`/skills?id=${s.id}`)}
              >
                Ver en hub
              </button>
              <button
                className="retro-btn small"
                onClick={() => void cloneSkill(s.id)}
              >
                Usar en mi biblioteca
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
