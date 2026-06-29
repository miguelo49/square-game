import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { LevelSchema } from '../types';
import { renderLevelThumbnail } from '../utils/levelThumbnail';

type ProfileLevel = {
  id: string;
  name: string;
  data: LevelSchema;
  playCount: number;
  clearCount: number;
  likeCount: number;
  clearRate: number;
  tags: string[];
};

export function UserProfilePage() {
  const { nickname = '' } = useParams();
  const navigate = useNavigate();
  const [levels, setLevels] = useState<ProfileLevel[]>([]);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!nickname) return;
    setLoading(true);
    void api.users
      .getProfile(nickname)
      .then((p) => {
        setLevels(p.levels);
        setCreatedAt(p.createdAt);
        setError('');
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [nickname]);

  if (loading) return <div className="page loading">Cargando perfil...</div>;
  if (error) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="retro-btn secondary" onClick={() => navigate('/')}>
            ← Menú
          </button>
          <h2>Perfil</h2>
        </header>
        <p className="empty-list">{error}</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="page-header">
        <button className="retro-btn secondary" onClick={() => navigate('/')}>
          ← Menú
        </button>
        <h2>{nickname}</h2>
        {createdAt && (
          <span className="hint">
            Miembro desde {new Date(createdAt * 1000).toLocaleDateString()}
          </span>
        )}
      </header>

      <h3 className="sidebar-section-title">Niveles públicos ({levels.length})</h3>
      {levels.length === 0 ? (
        <p className="empty-list">Sin niveles públicos</p>
      ) : (
        <div className="community-list">
          {levels.map((l) => (
            <div key={l.id} className="community-card">
              <img
                src={renderLevelThumbnail(l.data)}
                alt=""
                className="level-thumb"
                width={140}
                height={80}
              />
              <strong>{l.name}</strong>
              <span className="level-stats-row">
                {l.playCount} plays · {l.clearRate}% clear · ♥ {l.likeCount}
              </span>
              {l.tags.length > 0 && (
                <div className="level-tags">
                  {l.tags.map((t) => (
                    <span key={t} className="tag-chip">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <button
                className="retro-btn small"
                onClick={() => navigate(`/play?level=${l.id}`)}
              >
                Jugar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
