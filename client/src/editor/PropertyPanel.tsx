import type { LevelSchema } from '../types';
import type { MusicTrackRef } from '../hooks/useGameContent';
import { estimateLevelSize } from '../storage/compression';
import { LEVEL_THEMES, applyTheme } from '../data/levelThemes';
import { MusicPlayer } from '../audio/MusicPlayer';
import { useEffect, useRef, useState } from 'react';

interface PropertyPanelProps {
  level: LevelSchema;
  onChange: (level: LevelSchema) => void;
  levelName: string;
  onNameChange: (name: string) => void;
  onEditMusic?: () => void;
  musicTracks?: MusicTrackRef[];
  assets?: import('../types').AssetSchema[];
}

export function PropertyPanel({
  level,
  onChange,
  levelName,
  onNameChange,
  onEditMusic,
  musicTracks = [],
  assets = [],
}: PropertyPanelProps) {
  const size = estimateLevelSize(level);
  const previewPlayer = useRef<MusicPlayer | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    return () => previewPlayer.current?.stop();
  }, []);

  const handleGenerateMusic = () => {
    const seed = Math.floor(Math.random() * 999999);
    const next = { ...level, musicSeed: seed };
    delete next.music;
    onChange(next);
    previewPlayer.current?.stop();
    setPreviewing(false);
  };

  const handleClearMusic = () => {
    previewPlayer.current?.stop();
    setPreviewing(false);
    const next = { ...level };
    delete next.musicSeed;
    delete next.music;
    onChange(next);
  };

  const togglePreview = () => {
    if (!previewPlayer.current) previewPlayer.current = new MusicPlayer();
    if (previewing) {
      previewPlayer.current.stop();
      setPreviewing(false);
    } else if (level.music) {
      void previewPlayer.current.playSchema(level.music);
      setPreviewing(true);
    } else if (level.musicSeed != null) {
      void previewPlayer.current.play(level.musicSeed);
      setPreviewing(true);
    }
  };

  const hasMusic =
    level.music != null || level.musicSeed != null || level.musicTrackId != null;

  const selectTrack = (trackId: string) => {
    if (!trackId) {
      const next = { ...level };
      delete next.musicTrackId;
      onChange(next);
      return;
    }
    const next = { ...level, musicTrackId: trackId };
    delete next.music;
    delete next.musicSeed;
    onChange(next);
  };

  return (
    <div className="property-panel">
      <h3>Propiedades</h3>
      <label>
        Nombre del nivel
        <input
          value={levelName}
          onChange={(e) => onNameChange(e.target.value)}
          className="retro-input"
        />
      </label>
      <label>
        Tema
        <select
          className="retro-input"
          value={level.themeId ?? 'void'}
          onChange={(e) => onChange({ ...level, ...applyTheme(e.target.value) })}
        >
          {Object.values(LEVEL_THEMES).map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Asset jugador
        <select
          className="retro-input"
          value={level.playerAssetId ?? ''}
          onChange={(e) =>
            onChange({ ...level, playerAssetId: e.target.value || undefined })
          }
        >
          <option value="">— Default —</option>
          {assets
            .filter((a) => a.category === 'player')
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.id}
              </option>
            ))}
        </select>
      </label>
      <label>
        Tile plataforma default
        <select
          className="retro-input"
          value={level.defaultPlatformAssetId ?? ''}
          onChange={(e) =>
            onChange({ ...level, defaultPlatformAssetId: e.target.value || undefined })
          }
        >
          <option value="">— Default —</option>
          {assets
            .filter((a) => a.category === 'platform')
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.id}
              </option>
            ))}
        </select>
      </label>
      <label>
        Victoria
        <select
          className="retro-input"
          value={level.winCondition?.type ?? 'portal'}
          onChange={(e) =>
            onChange({
              ...level,
              winCondition: {
                type: e.target.value as 'portal' | 'coins' | 'enemies' | 'survive',
                target: level.winCondition?.target,
              },
            })
          }
        >
          <option value="portal">Llegar al portal</option>
          <option value="coins">Recoger monedas</option>
          <option value="enemies">Derrotar enemigos</option>
          <option value="survive">Sobrevivir tiempo</option>
        </select>
      </label>
      {level.winCondition?.type && level.winCondition.type !== 'portal' && (
        <label>
          Objetivo
          <input
            type="number"
            className="retro-input"
            min={1}
            value={level.winCondition.target ?? 1}
            onChange={(e) =>
              onChange({
                ...level,
                winCondition: {
                  ...level.winCondition!,
                  target: Number(e.target.value),
                },
              })
            }
          />
        </label>
      )}
      <label>
        <input
          type="color"
          value={level.backgroundColor}
          onChange={(e) => onChange({ ...level, backgroundColor: e.target.value })}
          className="retro-input"
        />
      </label>
      <label>
        Ancho mundo
        <input
          type="number"
          value={level.width}
          onChange={(e) => onChange({ ...level, width: Number(e.target.value) })}
          className="retro-input"
          step={32}
        />
      </label>
      <label>
        Alto mundo
        <input
          type="number"
          value={level.height}
          onChange={(e) => onChange({ ...level, height: Number(e.target.value) })}
          className="retro-input"
          step={32}
        />
      </label>
      <div className="music-panel">
        <h4>Música</h4>
        <p className="music-seed">
          {level.musicTrackId
            ? `Pista: ${musicTracks.find((t) => t.id === level.musicTrackId)?.name ?? level.musicTrackId}`
            : level.music
              ? `Composición (${level.music.notes.length} notas)`
              : level.musicSeed != null
                ? `Seed: ${level.musicSeed}`
                : 'Sin música'}
        </p>
        {musicTracks.length > 0 && (
          <label>
            Pista de biblioteca
            <select
              className="retro-input"
              value={level.musicTrackId ?? ''}
              onChange={(e) => selectTrack(e.target.value)}
            >
              <option value="">— Ninguna —</option>
              {musicTracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="btn-row">
          {onEditMusic && (
            <button type="button" className="retro-btn small" onClick={onEditMusic}>
              Editar música
            </button>
          )}
          <button type="button" className="retro-btn small" onClick={handleGenerateMusic}>
            Generar aleatorio
          </button>
          {hasMusic && (
            <>
              <button type="button" className="retro-btn small" onClick={togglePreview}>
                {previewing ? '■ Stop' : '▶ Preview'}
              </button>
              <button type="button" className="retro-btn small danger" onClick={handleClearMusic}>
                Quitar
              </button>
            </>
          )}
        </div>
      </div>
      <div className="stats">
        <p>Plataformas: {level.platforms.length}</p>
        <p>Monedas: {level.coins?.length ?? 0}</p>
        <p>Checkpoints: {level.checkpoints?.length ?? 0}</p>
        <p>Spawn: ({level.spawn.x}, {level.spawn.y})</p>
        <p>Portal: ({level.portal.x}, {level.portal.y})</p>
        <p>Tamaño JSON: ~{(size / 1024).toFixed(1)} KB</p>
      </div>
    </div>
  );
}
