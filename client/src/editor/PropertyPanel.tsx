import type { LevelSchema } from '../types';
import { estimateLevelSize } from '../storage/compression';
import { MusicPlayer } from '../audio/MusicPlayer';
import { useEffect, useRef, useState } from 'react';

interface PropertyPanelProps {
  level: LevelSchema;
  onChange: (level: LevelSchema) => void;
  levelName: string;
  onNameChange: (name: string) => void;
  onEditMusic?: () => void;
}

export function PropertyPanel({
  level,
  onChange,
  levelName,
  onNameChange,
  onEditMusic,
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

  const hasMusic = level.music != null || level.musicSeed != null;

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
        Color de fondo
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
          {level.music
            ? `Composición (${level.music.notes.length} notas)`
            : level.musicSeed != null
              ? `Seed: ${level.musicSeed}`
              : 'Sin música'}
        </p>
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
        <p>Enemigos: {level.enemies.length}</p>
        <p>Spawn: ({level.spawn.x}, {level.spawn.y})</p>
        <p>Portal: ({level.portal.x}, {level.portal.y})</p>
        <p>Tamaño JSON: ~{(size / 1024).toFixed(1)} KB</p>
      </div>
    </div>
  );
}
