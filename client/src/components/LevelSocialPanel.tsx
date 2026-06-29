import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

type Comment = { id: string; body: string; createdAt: number; nickname: string };

interface LevelSocialPanelProps {
  levelId: string;
  authorNickname?: string;
  playCount?: number;
  clearCount?: number;
  clearRate?: number;
  likeCount?: number;
  userLiked?: boolean;
  tags?: string[];
  onMetaChange?: () => void;
}

export function LevelSocialPanel({
  levelId,
  authorNickname,
  playCount = 0,
  clearCount = 0,
  clearRate = 0,
  likeCount: initialLikes = 0,
  userLiked: initialLiked = false,
  tags = [],
  onMetaChange,
}: LevelSocialPanelProps) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikes);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    setLiked(initialLiked);
    setLikeCount(initialLikes);
  }, [initialLiked, initialLikes, levelId]);

  const loadComments = useCallback(async () => {
    const list = await api.levels.comments(levelId);
    setComments(list);
  }, [levelId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const toggleLike = async () => {
    const res = await api.levels.like(levelId);
    setLiked(res.liked);
    setLikeCount((c) => (res.liked ? c + 1 : Math.max(0, c - 1)));
    onMetaChange?.();
  };

  const postComment = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      await api.levels.addComment(levelId, body);
      setDraft('');
      await loadComments();
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="level-social-panel">
      {authorNickname && (
        <p className="level-author">
          por{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => navigate(`/user/${encodeURIComponent(authorNickname)}`)}
          >
            {authorNickname}
          </button>
        </p>
      )}

      <div className="level-stats-row">
        <span title="Partidas">{playCount} plays</span>
        <span title="Completados">{clearCount} clears</span>
        <span title="Clear rate">{clearRate}% clear</span>
      </div>

      {tags.length > 0 && (
        <div className="level-tags">
          {tags.map((t) => (
            <span key={t} className="tag-chip">
              {t}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        className={`retro-btn small like-btn ${liked ? 'active' : ''}`}
        onClick={() => void toggleLike()}
      >
        {liked ? '♥' : '♡'} {likeCount}
      </button>

      <div className="comments-section">
        <h4>Comentarios</h4>
        <div className="comment-compose">
          <input
            className="retro-input"
            value={draft}
            maxLength={500}
            placeholder="Escribe un comentario..."
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void postComment();
            }}
          />
          <button
            type="button"
            className="retro-btn small"
            disabled={!draft.trim() || posting}
            onClick={() => void postComment()}
          >
            Enviar
          </button>
        </div>
        {comments.length === 0 ? (
          <p className="hint">Sin comentarios aún</p>
        ) : (
          <ul className="comment-list">
            {comments.map((c) => (
              <li key={c.id}>
                <strong>{c.nickname}</strong>: {c.body}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
