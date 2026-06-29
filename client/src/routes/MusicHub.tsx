import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { LevelSchema, MusicSchema } from '../types';
import { MusicEditor } from './MusicEditor';
import { emptyMusicSchema } from '../audio/PolyMusicGenerator';
import { downloadSqmusic, importSqmusic } from '../storage/compression';

export function MusicHub() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tracks, setTracks] = useState<
    Array<{ id: string; name: string; data: MusicSchema; isPublic?: boolean }>
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trackName, setTrackName] = useState('Nueva pista');
  const [initialMusic, setInitialMusic] = useState<MusicSchema>(emptyMusicSchema());
  const [editorKey, setEditorKey] = useState(0);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  const loadTracks = useCallback(async () => {
    const list = await api.music.list();
    setTracks(list.map((t) => ({ id: t.id, name: t.name, data: t.data, isPublic: t.isPublic })));
  }, []);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id || tracks.length === 0) return;
    const t = tracks.find((tr) => tr.id === id);
    if (t) loadTrack(t);
  }, [searchParams, tracks]);

  const startNew = () => {
    setSelectedId(null);
    setTrackName('Nueva pista');
    setInitialMusic(emptyMusicSchema());
    setEditorKey((k) => k + 1);
  };

  const loadTrack = (t: (typeof tracks)[0]) => {
    setSelectedId(t.id);
    setIsPublic(t.isPublic ?? false);
    setTrackName(t.name);
    setInitialMusic({ ...t.data, notes: [...t.data.notes] });
    setEditorKey((k) => k + 1);
  };

  const persistTrack = async (music: MusicSchema) => {
    setSaving(true);
    setMessage('');
    try {
      if (selectedId) {
        await api.music.update(selectedId, trackName, music);
        setMessage('Pista guardada!');
      } else {
        const res = await api.music.create(trackName, music);
        setSelectedId(res.id);
        setMessage('Pista creada!');
      }
      await loadTracks();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await api.music.delete(id);
    if (selectedId === id) startNew();
    await loadTracks();
  };

  const handleExport = () => {
    downloadSqmusic({ name: trackName, data: initialMusic }, trackName.replace(/\s+/g, '_'));
    setMessage('Exportado — guarda antes si hay cambios sin guardar en el piano roll');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importSqmusic(file);
      setTrackName(imported.name);
      setInitialMusic(imported.data);
      setSelectedId(null);
      setEditorKey((k) => k + 1);
      setMessage('Importado — pulsa Guardar en el piano roll');
    } catch {
      setMessage('Error al importar');
    }
  };

  return (
    <div className="music-hub-page">
      <header className="page-header">
        <button className="retro-btn secondary" onClick={() => navigate('/')}>
          ← Menú
        </button>
        <h2>Compositor de Música</h2>
        <div className="header-actions">
          {selectedId && (
            <button
              className={`retro-btn ${isPublic ? 'active' : ''}`}
              onClick={async () => {
                const res = await api.music.share(selectedId);
                setIsPublic(res.isPublic);
                setMessage(res.isPublic ? 'Pista compartida!' : 'Pista ya no es pública');
                await loadTracks();
              }}
            >
              {isPublic ? 'Dejar de compartir' : 'Compartir'}
            </button>
          )}
          <button className="retro-btn" onClick={startNew}>
            + Nueva
          </button>
          <button className="retro-btn" onClick={handleExport}>
            Exportar
          </button>
          <label className="retro-btn file-label">
            Importar
            <input type="file" accept=".sqmusic" onChange={handleImport} hidden />
          </label>
        </div>
      </header>

      {message && <p className="toast">{message}</p>}
      {saving && <p className="toast">Guardando...</p>}

      <div className="music-hub-layout">
        <aside className="music-hub-sidebar">
          <label>
            Nombre
            <input
              className="retro-input"
              value={trackName}
              onChange={(e) => setTrackName(e.target.value)}
            />
          </label>
          <h3>Mis pistas</h3>
          <div className="track-list">
            {tracks.map((t) => (
              <div key={t.id} className="asset-list-item">
                <button
                  className={`retro-btn small ${selectedId === t.id ? 'active' : ''}`}
                  onClick={() => loadTrack(t)}
                >
                  {t.name}
                </button>
                <button
                  className="retro-btn small danger"
                  onClick={() => handleDelete(t.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="music-hub-editor">
          <MusicEditor
            key={editorKey}
            embedded
            initialLevel={{ music: initialMusic } as LevelSchema}
            onSave={(music) => {
              setInitialMusic(music);
              void persistTrack(music);
            }}
          />
        </div>
      </div>
    </div>
  );
}
