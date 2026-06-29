import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { api } from '../api/client';
import type { AssetSchema, AssetCategory, AssetAnimClip, AssetClipDef } from '../types';
import { PixelCanvas, createEmptyAsset, validateAssetPixels } from '../editor/PixelCanvas';
import { normalizeAssetPixels } from '../data/snesPalette';
import { ALLOWED_SIZES } from '../data/retroLimits';
import { migrateAssetAnimations } from '../game/utils/assetAnimations';

export function AssetEditor() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<AssetCategory>('player');
  const [size, setSize] = useState<number>(() => createEmptyAsset('player').width);
  const [name, setName] = useState('Mi Asset');
  const [pixels, setPixels] = useState<number[]>(() => createEmptyAsset('player').pixels);
  const [animations, setAnimations] = useState<Partial<Record<AssetAnimClip, AssetClipDef>>>(
    () => createEmptyAsset('player').animations
  );
  const [paletteSlots, setPaletteSlots] = useState<number[]>(
    () => createEmptyAsset('player').paletteSlots
  );
  const [assets, setAssets] = useState<Array<{ id: string; name: string; data: AssetSchema }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.assets.list().then(setAssets);
  }, []);

  const handleCategoryChange = (cat: AssetCategory) => {
    setCategory(cat);
    const empty = createEmptyAsset(cat);
    setSize(empty.width);
    setPixels(empty.pixels);
    setAnimations(empty.animations);
    setPaletteSlots(empty.paletteSlots);
    setEditingId(null);
    setIsPublic(false);
  };

  const handleSizeChange = (s: number) => {
    setSize(s);
    const empty = createEmptyAsset(category, s);
    setPixels(empty.pixels);
    setAnimations(empty.animations);
    setPaletteSlots(empty.paletteSlots);
  };

  const validateAllClips = (): string | null => {
    const anims = migrateAssetAnimations({ pixels, paletteSlots, animations } as AssetSchema);
    for (const [clip, def] of Object.entries(anims)) {
      for (let i = 0; i < (def?.frames.length ?? 0); i++) {
        const normalized = normalizeAssetPixels(def!.frames[i]!, size, size);
        const err = validateAssetPixels(normalized, paletteSlots, size, size);
        if (err) return `${clip} frame ${i + 1}: ${err}`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const err = validateAllClips();
    if (err) {
      setMessage(err);
      return;
    }

    const normalizedAnims: Partial<Record<AssetAnimClip, AssetClipDef>> = {};
    for (const [clip, def] of Object.entries(animations)) {
      if (!def?.frames?.length) continue;
      normalizedAnims[clip as AssetAnimClip] = {
        ...def,
        frames: def.frames.map((f) => normalizeAssetPixels(f, size, size)),
      };
    }

    const idle = normalizedAnims.idle?.frames?.[0] ?? pixels;
    const asset: AssetSchema = {
      id: editingId ?? uuidv4(),
      category,
      width: size as 8 | 16 | 32,
      height: size as 8 | 16 | 32,
      pixels: idle,
      paletteSlots,
      name,
      animations: Object.keys(normalizedAnims).length ? normalizedAnims : undefined,
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

  const loadAsset = (a: { id: string; name: string; data: AssetSchema; isPublic?: boolean }) => {
    setEditingId(a.id);
    setIsPublic(a.isPublic ?? false);
    setName(a.name);
    setCategory(a.data.category);
    setSize(a.data.width);
    setPixels([...a.data.pixels]);
    setAnimations(JSON.parse(JSON.stringify(migrateAssetAnimations(a.data))));
    setPaletteSlots([...a.data.paletteSlots]);
  };

  const handleDelete = async (id: string) => {
    await api.assets.delete(id);
    setAssets(await api.assets.list());
    if (editingId === id) {
      handleCategoryChange(category);
    }
  };

  const clipCount = Object.keys(animations).length;

  return (
    <div className="asset-page">
      <header className="page-header">
        <button className="retro-btn secondary" onClick={() => navigate('/')}>
          ← Menú
        </button>
        <h2>Crear Assets</h2>
        <div className="header-actions">
          {editingId && (
            <button
              className={`retro-btn ${isPublic ? 'active' : ''}`}
              onClick={async () => {
                const res = await api.assets.share(editingId);
                setIsPublic(res.isPublic);
                setMessage(res.isPublic ? 'Asset compartido!' : 'Asset ya no es público');
              }}
            >
              {isPublic ? 'Dejar de compartir' : 'Compartir'}
            </button>
          )}
          <button className="retro-btn primary" onClick={handleSave}>
            Guardar Asset
          </button>
        </div>
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
                  {a.name} ({a.data.width}px)
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
            initialAnimations={animations}
            initialPaletteSlots={paletteSlots}
            onChange={({ pixels: p, animations: an, paletteSlots: ps }) => {
              setPixels(p);
              setAnimations(an);
              setPaletteSlots(ps);
            }}
          />
          <p className="hint">Clips activos: {clipCount} · idle/walk/jump/fall/shoot/hurt</p>
        </div>
      </div>
    </div>
  );
}
