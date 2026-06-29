import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { LevelSchema, MusicNote, MusicSchema } from '../types';
import {
  emptyMusicSchema,
  PITCH_MIN,
  PITCH_MAX,
  VOICE_COUNT,
  STEPS_PER_BEAT,
  noteLabel,
  findNoteAt,
} from '../audio/PolyMusicGenerator';
import { MusicPlayer } from '../audio/MusicPlayer';

const CELL_W = 14;
const CELL_H = 12;

interface MusicEditorProps {
  initialLevel?: LevelSchema;
  onSave?: (music: MusicSchema) => void;
  embedded?: boolean;
}

export function MusicEditor({ initialLevel, onSave, embedded }: MusicEditorProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const levelKey = searchParams.get('level');

  const [schema, setSchema] = useState<MusicSchema>(() =>
    initialLevel?.music ? { ...initialLevel.music, notes: [...initialLevel.music.notes] } : emptyMusicSchema()
  );
  const [voiceWaves, setVoiceWaves] = useState<Array<'square' | 'triangle'>>([
    'square',
    'triangle',
    'square',
    'triangle',
  ]);
  const [previewing, setPreviewing] = useState(false);
  const playerRef = useRef<MusicPlayer | null>(null);
  const dragRef = useRef<{ voice: number; pitch: number; startBeat: number } | null>(null);

  useEffect(() => () => playerRef.current?.stop(), []);

  const totalBeats = schema.bars * 4;
  const pitches = Array.from({ length: PITCH_MAX - PITCH_MIN + 1 }, (_, i) => PITCH_MAX - i);

  const notesWithWave = useCallback(
    (): MusicNote[] =>
      schema.notes.map((n) => ({
        ...n,
        wave: n.wave ?? voiceWaves[n.voice] ?? 'square',
      })),
    [schema.notes, voiceWaves]
  );

  const previewSchema = useCallback(() => {
    if (!playerRef.current) playerRef.current = new MusicPlayer();
    if (previewing) {
      playerRef.current.stop();
      setPreviewing(false);
    } else {
      void playerRef.current.playSchema({ ...schema, notes: notesWithWave() });
      setPreviewing(true);
    }
  }, [schema, notesWithWave, previewing]);

  const beatFromX = (clientX: number, gridLeft: number) => {
    const x = clientX - gridLeft;
    const step = Math.floor(x / CELL_W);
    return Math.max(0, Math.min(totalBeats - 0.25, step / STEPS_PER_BEAT));
  };

  const pitchFromY = (clientY: number, gridTop: number) => {
    const y = clientY - gridTop;
    const row = Math.floor(y / CELL_H);
    return PITCH_MAX - row;
  };

  const toggleNote = (voice: number, pitch: number, startBeat: number) => {
    const snapped = Math.round(startBeat * STEPS_PER_BEAT) / STEPS_PER_BEAT;
    const existing = findNoteAt(schema.notes, voice, pitch, snapped);
    if (existing) {
      setSchema({
        ...schema,
        notes: schema.notes.filter((n) => n !== existing),
      });
    } else {
      setSchema({
        ...schema,
        notes: [
          ...schema.notes,
          {
            voice,
            pitch,
            startBeat: snapped,
            duration: 1 / STEPS_PER_BEAT,
            wave: voiceWaves[voice] ?? 'square',
          },
        ],
      });
    }
  };

  const handleGridPointer = (
    e: React.PointerEvent,
    voice: number,
    gridEl: HTMLDivElement
  ) => {
    const rect = gridEl.getBoundingClientRect();
    const pitch = pitchFromY(e.clientY, rect.top);
    const beat = beatFromX(e.clientX, rect.left);
    if (pitch < PITCH_MIN || pitch > PITCH_MAX) return;

    if (e.type === 'pointerdown') {
      dragRef.current = { voice, pitch, startBeat: beat };
      toggleNote(voice, pitch, beat);
    } else if (e.type === 'pointermove' && e.buttons === 1 && dragRef.current) {
      const start = dragRef.current.startBeat;
      const end = beat;
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      const snappedFrom = Math.round(from * STEPS_PER_BEAT) / STEPS_PER_BEAT;
      const snappedTo = Math.round(to * STEPS_PER_BEAT) / STEPS_PER_BEAT;
      const dur = Math.max(1 / STEPS_PER_BEAT, snappedTo - snappedFrom + 1 / STEPS_PER_BEAT);

      setSchema((prev) => {
        const filtered = prev.notes.filter(
          (n) =>
            !(
              n.voice === voice &&
              n.pitch === dragRef.current!.pitch &&
              n.startBeat >= snappedFrom - 0.001 &&
              n.startBeat <= snappedTo + 0.001
            )
        );
        return {
          ...prev,
          notes: [
            ...filtered,
            {
              voice,
              pitch: dragRef.current!.pitch,
              startBeat: snappedFrom,
              duration: dur,
              wave: voiceWaves[voice] ?? 'square',
            },
          ],
        };
      });
    }
  };

  const handleSave = () => {
    const music = { ...schema, notes: notesWithWave() };
    if (onSave) {
      onSave(music);
    } else if (levelKey) {
      const stored = sessionStorage.getItem(`music-level-${levelKey}`);
      if (stored) {
        const level = JSON.parse(stored) as LevelSchema;
        sessionStorage.setItem(
          `music-level-${levelKey}`,
          JSON.stringify({ ...level, music })
        );
      }
      sessionStorage.setItem(`music-result-${levelKey}`, JSON.stringify(music));
    }
    playerRef.current?.stop();
    setPreviewing(false);
    if (!embedded) navigate(-1);
  };

  return (
    <div className={`music-editor ${embedded ? 'embedded' : ''}`}>
      {!embedded && (
        <header className="page-header">
          <button className="retro-btn secondary" onClick={() => navigate(-1)}>
            ← Volver
          </button>
          <h2>Editor de Música</h2>
        </header>
      )}

      <div className="music-toolbar">
        <label>
          BPM
          <input
            type="number"
            className="retro-input"
            min={60}
            max={200}
            value={schema.bpm}
            onChange={(e) => setSchema({ ...schema, bpm: Number(e.target.value) })}
          />
        </label>
        <label>
          Compases
          <input
            type="number"
            className="retro-input"
            min={1}
            max={8}
            value={schema.bars}
            onChange={(e) =>
              setSchema({ ...schema, bars: Math.min(8, Math.max(1, Number(e.target.value))) })
            }
          />
        </label>
        <button className="retro-btn" onClick={previewSchema}>
          {previewing ? '■ Stop' : '▶ Preview'}
        </button>
        <button className="retro-btn primary" onClick={handleSave}>
          Guardar
        </button>
      </div>

      <div className="piano-roll">
        <div className="pitch-labels">
          {pitches.map((p) => (
            <div key={p} className="pitch-label" style={{ height: CELL_H }}>
              {p % 12 === 0 ? noteLabel(p) : ''}
            </div>
          ))}
        </div>

        <div className="voice-tracks">
          {Array.from({ length: VOICE_COUNT }, (_, voice) => (
            <div key={voice} className="voice-track">
              <div className="voice-header">
                <span>Voz {voice + 1}</span>
                <select
                  className="retro-input"
                  value={voiceWaves[voice]}
                  onChange={(e) => {
                    const wave = e.target.value as 'square' | 'triangle';
                    const next = [...voiceWaves];
                    next[voice] = wave;
                    setVoiceWaves(next);
                    setSchema({
                      ...schema,
                      notes: schema.notes.map((n) =>
                        n.voice === voice ? { ...n, wave } : n
                      ),
                    });
                  }}
                >
                  <option value="square">Square</option>
                  <option value="triangle">Triangle</option>
                </select>
              </div>
              <div
                className="roll-grid"
                style={{
                  width: totalBeats * STEPS_PER_BEAT * CELL_W,
                  height: pitches.length * CELL_H,
                }}
                onPointerDown={(e) =>
                  handleGridPointer(e, voice, e.currentTarget)
                }
                onPointerMove={(e) =>
                  handleGridPointer(e, voice, e.currentTarget)
                }
                onPointerUp={() => {
                  dragRef.current = null;
                }}
                onPointerLeave={() => {
                  dragRef.current = null;
                }}
              >
                {pitches.map((pitch) =>
                  Array.from({ length: totalBeats * STEPS_PER_BEAT }, (_, step) => (
                    <div
                      key={`${pitch}-${step}`}
                      className={`roll-cell ${pitch % 12 === 0 ? 'octave' : ''} ${
                        step % STEPS_PER_BEAT === 0 ? 'beat' : ''
                      }`}
                      style={{ width: CELL_W, height: CELL_H }}
                    />
                  ))
                )}
                {schema.notes
                  .filter((n) => n.voice === voice)
                  .map((n, i) => (
                    <div
                      key={i}
                      className="roll-note"
                      style={{
                        left: n.startBeat * STEPS_PER_BEAT * CELL_W,
                        top: (PITCH_MAX - n.pitch) * CELL_H,
                        width: n.duration * STEPS_PER_BEAT * CELL_W - 1,
                        height: CELL_H - 2,
                      }}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="hint">
        Click coloca nota · Arrastra para alargar · {totalBeats} beats · C3–C6
      </p>
    </div>
  );
}

export function MusicEditorPage() {
  const [searchParams] = useSearchParams();
  const levelKey = searchParams.get('level') ?? 'draft';
  const navigate = useNavigate();

  const stored = sessionStorage.getItem(`music-level-${levelKey}`);
  const initialLevel = stored ? (JSON.parse(stored) as LevelSchema) : undefined;

  return (
    <MusicEditor
      initialLevel={initialLevel}
      onSave={(music) => {
        sessionStorage.setItem(`music-result-${levelKey}`, JSON.stringify(music));
        navigate(-1);
      }}
    />
  );
}
