import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { api } from '../api/client';
import type { AssetSchema, AssetCategory } from '../types';
import { PixelCanvas, createEmptyAsset, validateAssetPixels } from '../editor/PixelCanvas';
import { normalizeAssetPixels } from '../data/snesPalette';
import { ALLOWED_SIZES } from '../data/retroLimits';

export function AssetEditor() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<AssetCategory>('player');
  const [size, setSize] = useState<number>(() => createEmptyAsset('player').width);
  const [name, setName] = useState('Mi Asset');
  const [pixels, setPixels] = useState<number[]>(() => createEmptyAsset('player').pixels);
  const [frames, setFrames] = useState<number[][]>(() => createEmptyAsset('player').frames);
  const [fps, setFps] = useState(8);
  const [paletteSlots, setPaletteSlots] = useState<number[]>(
    () => createEmptyAsset('player').paletteSlots
  );
  const [assets, setAssets] = useState<Array<{ id: string; name: string; data: AssetSchema }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.assets.list().then(setAssets);
  }, []);

  const handleCategoryChange = (cat: AssetCategory) => {
    setCategory(cat);
    const empty = createEmptyAsset(cat);
    setSize(empty.width);
    setPixels(empty.pixels);
    setFrames(empty.frames);
    setFps(empty.fps);
    setPaletteSlots(empty.paletteSlots);
    setEditingId(null);
  };

  const handleSizeChange = (s: number) => {
    setSize(s);
    const empty = createEmptyAsset(category, s);
    setPixels(empty.pixels);
    setFrames(empty.frames);
    setPaletteSlots(empty.paletteSlots);
  };

  const validateAllFrames = (): string | null => {
    for (let i = 0; i < frames.length; i++) {
      const normalized = normalizeAssetPixels(frames[i]!, size, size);
      const err = validateAssetPixels(normalized, paletteSlots, size, size);
      if (err) return `Frame ${i + 1}: ${err}`;
    }
    return null;
  };

  const handleSave = async () => {
    const err = validateAllFrames();
    if (err) {
      setMessage(err);
      return;
    }

    const normalizedFrames = frames.map((f) => normalizeAssetPixels(f, size, size));
    const asset: AssetSchema = {
      id: editingId ?? uuidv4(),
      category,
      width: size as 8 | 16 | 32,
      height: size as 8 | 16 | 32,
      pixels: normalizedFrames[0]!,
      paletteSlots,
      name,
      frames: normalizedFrames.length > 1 ? normalizedFrames : undefined,
      fps: normalizedFrames.length > 1 ? fps : undefined,
    };

    try {
      if (editingId) {
        await api.assets.update(editingId, name, asset);
        setMessage('Asset actualizado!');
      } else {
        const res = await api.assets.create(name, asset);
        setEditingId(res.id);
        setMessage('Asset guardado!');
      }
      setAssets(await api.assets.list());
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const loadAsset = (a: { id: string; name: string; data: AssetSchema }) => {
    setEditingId(a.id);
    setName(a.name);
    setCategory(a.data.category);
    setSize(a.data.width);
    setPixels([...a.data.pixels]);
    setFrames(
      a.data.frames?.map((f) => [...f]) ?? [[...a.data.pixels]]
    );
    setFps(a.data.fps ?? 8);
    setPaletteSlots([...a.data.paletteSlots]);
  };

  const handleDelete = async (id: string) => {
    await api.assets.delete(id);
    setAssets(await api.assets.list());
    if (editingId === id) {
      handleCategoryChange(category);
    }
  };

  return (
    <div className="asset-page">
      <header className="page-header">
        <button className="retro-btn secondary" onClick={() => navigate('/')}>
          ← Menú
        </button>
        <h2>Crear Assets</h2>
        <button className="retro-btn primary" onClick={handleSave}>
          Guardar Asset
        </button>
      </header>

      {message && <p className="toast">{message}</p>}

      <div className="asset-layout">
        <aside className="asset-sidebar">
          <h3>Categoría</h3>
          {(['player', 'platform', 'enemy'] as AssetCategory[]).map((cat) => (
            <button
              key={cat}
              className={`retro-btn ${category === cat ? 'active' : ''}`}
              onClick={() => handleCategoryChange(cat)}
            >
              {cat === 'player' ? 'Square' : cat === 'platform' ? 'Plataforma' : 'Enemigo △'}
            </button>
          ))}

          <h3>Tamaño</h3>
          {ALLOWED_SIZES[category].map((s) => (
            <button
              key={s}
              className={`retro-btn small ${size === s ? 'active' : ''}`}
              onClick={() => handleSizeChange(s)}
            >
              {s}×{s}
            </button>
          ))}

          <label>
            Nombre
            <input
              className="retro-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <h3>Mis Assets</h3>
          <div className="asset-list">
            {assets.map((a) => (
              <div key={a.id} className="asset-list-item">
                <button className="retro-btn small" onClick={() => loadAsset(a)}>
                  {a.name} ({a.data.width}px{a.data.frames ? ` · ${a.data.frames.length}f` : ''})
                </button>
                <button
                  className="retro-btn small danger"
                  onClick={() => handleDelete(a.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="pixel-panel">
          <PixelCanvas
            key={`${category}-${size}-${editingId ?? 'new'}`}
            category={category}
            width={size}
            height={size}
            initialPixels={pixels}
            initialFrames={frames}
            initialPaletteSlots={paletteSlots}
            initialFps={fps}
            onChange={({ pixels: p, frames: f, paletteSlots: ps, fps: fp }) => {
              setPixels(p);
              setFrames(f);
              setPaletteSlots(ps);
              setFps(fp);
            }}
          />
        </div>
      </div>
    </div>
  );
}
