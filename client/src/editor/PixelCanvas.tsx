import { useEffect, useRef, useState, useCallback } from 'react';
import type { AssetCategory, AssetAnimClip, AssetClipDef } from '../types';
import { ASSET_ANIM_CLIPS } from '../types';
import { clipLoopsByDefault } from '../game/utils/assetAnimations';
import {
  SNES_PALETTE,
  DEFAULT_PALETTE_SLOTS,
  paletteColor,
  validateAssetPixels,
} from '../data/snesPalette';
import { ALLOWED_SIZES, DEFAULT_SIZES, MAX_COLORS_PER_SPRITE } from '../data/retroLimits';

type Tool = 'pencil' | 'eraser' | 'fill';
const MAX_FRAMES = 6;
const MAX_UNDO = 50;

interface PixelCanvasProps {
  category: AssetCategory;
  width: number;
  height: number;
  initialPixels?: number[];
  initialFrames?: number[][];
  initialPaletteSlots?: number[];
  initialFps?: number;
  initialAnimations?: Partial<Record<AssetAnimClip, AssetClipDef>>;
  onChange?: (data: {
    pixels: number[];
    frames: number[][];
    paletteSlots: number[];
    fps: number;
    animations: Partial<Record<AssetAnimClip, AssetClipDef>>;
  }) => void;
}

export function PixelCanvas({
  category,
  width,
  height,
  initialPixels,
  initialFrames,
  initialPaletteSlots,
  initialFps = 8,
  initialAnimations,
  onChange,
}: PixelCanvasProps) {
  const emptyFrame = () => new Array(width * height).fill(0);
  const buildInitialAnimations = (): Partial<Record<AssetAnimClip, AssetClipDef>> => {
    if (initialAnimations && Object.keys(initialAnimations).length > 0) {
      return JSON.parse(JSON.stringify(initialAnimations));
    }
    const idleFrames = initialFrames?.length
      ? initialFrames.map((f) => [...f])
      : [initialPixels ? [...initialPixels] : emptyFrame()];
    return {
      idle: { frames: idleFrames, fps: initialFps, loop: true },
    };
  };

  const [activeClip, setActiveClip] = useState<AssetAnimClip>('idle');
  const [animations, setAnimations] = useState<Partial<Record<AssetAnimClip, AssetClipDef>>>(
    buildInitialAnimations
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const undoStack = useRef<number[][]>([]);
  const [tool, setTool] = useState<Tool>('pencil');
  const [selectedColor, setSelectedColor] = useState(1);
  const [selectedSlot, setSelectedSlot] = useState(1);
  const [paletteSlots, setPaletteSlots] = useState<number[]>(
    () => initialPaletteSlots ?? [...DEFAULT_PALETTE_SLOTS]
  );
  const [frames, setFrames] = useState<number[][]>(() => {
    const anims = buildInitialAnimations();
    return anims.idle?.frames?.map((f) => [...f]) ?? [emptyFrame()];
  });
  const [frameIndex, setFrameIndex] = useState(0);
  const [fps, setFps] = useState(() => animations.idle?.fps ?? initialFps);
  const [clipLoop, setClipLoop] = useState(() => animations.idle?.loop ?? true);
  const [onionSkin, setOnionSkin] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const pixelSize = Math.min(16, Math.floor(512 / Math.max(width, height)));

  const pixels = frames[frameIndex] ?? new Array(width * height).fill(0);

  const emitChange = useCallback(
    (
      nextFrames: number[][],
      nextPalette: number[],
      nextFps: number,
      nextLoop: boolean,
      clip: AssetAnimClip,
      allAnims: Partial<Record<AssetAnimClip, AssetClipDef>>
    ) => {
      const updated = { ...allAnims };
      if (nextFrames.some((f) => f.some((p) => p !== 0))) {
        updated[clip] = { frames: nextFrames, fps: nextFps, loop: nextLoop };
      } else {
        delete updated[clip];
      }
      const idle = updated.idle?.frames?.[0] ?? nextFrames[0] ?? [];
      onChange?.({
        pixels: idle,
        frames: updated.idle?.frames ?? nextFrames,
        paletteSlots: nextPalette,
        fps: nextFps,
        animations: updated,
      });
    },
    [onChange]
  );

  const syncClipToState = useCallback(
    (clip: AssetAnimClip, anims: Partial<Record<AssetAnimClip, AssetClipDef>>) => {
      const def = anims[clip];
      const nextFrames = def?.frames?.map((f) => [...f]) ?? [emptyFrame()];
      setFrames(nextFrames);
      setFrameIndex(0);
      setFps(def?.fps ?? 8);
      setClipLoop(def?.loop ?? clipLoopsByDefault(clip));
    },
    [width, height]
  );

  const switchClip = (clip: AssetAnimClip) => {
    const merged = { ...animations, [activeClip]: { frames, fps, loop: clipLoop } };
    if (!frames.some((f) => f.some((p) => p !== 0))) delete merged[activeClip];
    setAnimations(merged);
    setActiveClip(clip);
    syncClipToState(clip, merged);
  };

  const setFramePixels = useCallback(
    (idx: number, nextPixels: number[]) => {
      setFrames((prev) => {
        const copy = prev.map((f) => [...f]);
        copy[idx] = nextPixels;
        emitChange(copy, paletteSlots, fps, clipLoop, activeClip, animations);
        return copy;
      });
    },
    [emitChange, paletteSlots, fps, clipLoop, activeClip, animations]
  );

  const pushUndo = useCallback(() => {
    undoStack.current.push([...pixels]);
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
  }, [pixels]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setFramePixels(frameIndex, prev);
  }, [frameIndex, setFramePixels]);

  const clearFrame = useCallback(() => {
    pushUndo();
    setFramePixels(frameIndex, new Array(width * height).fill(0));
  }, [frameIndex, width, height, pushUndo, setFramePixels]);

  const addFrame = useCallback(() => {
    if (frames.length >= MAX_FRAMES) return;
    const dup = [...(frames[frameIndex] ?? pixels)];
    setFrames((prev) => {
      const copy = [...prev, dup];
      emitChange(copy, paletteSlots, fps, clipLoop, activeClip, animations);
      return copy;
    });
    setFrameIndex(frames.length);
  }, [frames, frameIndex, pixels, emitChange, paletteSlots, fps, clipLoop, activeClip, animations]);

  const duplicateFrame = useCallback(() => {
    if (frames.length >= MAX_FRAMES) return;
    addFrame();
  }, [addFrame, frames.length]);

  const removeFrame = useCallback(() => {
    if (frames.length <= 1) return;
    setFrames((prev) => {
      const copy = prev.filter((_, i) => i !== frameIndex);
      emitChange(copy, paletteSlots, fps, clipLoop, activeClip, animations);
      return copy;
    });
    setFrameIndex((i) => Math.max(0, i - 1));
  }, [frameIndex, frames.length, emitChange, paletteSlots, fps, clipLoop, activeClip, animations]);

  const assignMasterToSlot = useCallback(
    (masterIdx: number) => {
      if (selectedSlot < 1) return;
      const next = [...paletteSlots];
      next[selectedSlot] = masterIdx;
      setPaletteSlots(next);
      emitChange(frames, next, fps, clipLoop, activeClip, animations);
    },
    [selectedSlot, paletteSlots, frames, fps, clipLoop, activeClip, animations, emitChange]
  );

  const usedMasterColors = new Set<number>();
  for (const clip of Object.values(animations)) {
    for (const f of clip?.frames ?? []) {
      for (const p of f) {
        if (p !== 0) usedMasterColors.add(paletteSlots[p] ?? p);
      }
    }
  }
  for (const f of frames) {
    for (const p of f) {
      if (p !== 0) usedMasterColors.add(paletteSlots[p] ?? p);
    }
  }

  const paint = useCallback(
    (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const idx = y * width + x;
      const next = [...pixels];
      next[idx] = tool === 'eraser' ? 0 : selectedColor;
      setFramePixels(frameIndex, next);
    },
    [width, height, tool, selectedColor, pixels, frameIndex, setFramePixels]
  );

  const fill = useCallback(
    (x: number, y: number) => {
      const target = pixels[y * width + x];
      const replacement = selectedColor;
      if (target === replacement) return;
      pushUndo();
      const next = [...pixels];
      const stack: [number, number][] = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        const ci = cy * width + cx;
        if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
        if (next[ci] !== target) continue;
        next[ci] = replacement;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      setFramePixels(frameIndex, next);
    },
    [pixels, width, height, selectedColor, pushUndo, frameIndex, setFramePixels]
  );

  const drawPixels = (
    ctx: CanvasRenderingContext2D,
    px: number[],
    alpha = 1
  ) => {
    ctx.globalAlpha = alpha;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = px[y * width + x] ?? 0;
        const masterIdx = paletteSlots[idx] ?? idx;
        ctx.fillStyle = idx === 0 ? '#1a1a2e' : paletteColor(masterIdx);
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    }
    ctx.globalAlpha = 1;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (onionSkin) {
      const prev = frames[frameIndex - 1];
      const next = frames[frameIndex + 1];
      if (prev) drawPixels(ctx, prev, 0.25);
      if (next) drawPixels(ctx, next, 0.25);
    }
    drawPixels(ctx, pixels, 1);

    ctx.strokeStyle = '#333';
    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * pixelSize, 0);
      ctx.lineTo(x * pixelSize, height * pixelSize);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * pixelSize);
      ctx.lineTo(width * pixelSize, y * pixelSize);
      ctx.stroke();
    }
  }, [pixels, frames, frameIndex, onionSkin, width, height, pixelSize, paletteSlots]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'z') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      undo();
    };
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [undo]);

  const handlePointer = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / pixelSize);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / pixelSize);
    if (tool === 'fill') fill(x, y);
    else paint(x, y);
  };

  const allowedSizes = ALLOWED_SIZES[category];

  return (
    <div ref={containerRef} className="pixel-editor" tabIndex={0} onPointerDown={() => containerRef.current?.focus()}>
      <div className="pixel-editor-info">
        <span>{width}×{height} — {usedMasterColors.size}/{MAX_COLORS_PER_SPRITE - 1} colores</span>
        <span>Frames: {frames.length}/{MAX_FRAMES}</span>
      </div>

      <div className="clip-tabs">
        {ASSET_ANIM_CLIPS.map((clip) => (
          <button
            key={clip}
            className={`retro-btn small ${activeClip === clip ? 'active' : ''} ${animations[clip] ? 'has-data' : ''}`}
            onClick={() => switchClip(clip)}
          >
            {clip}
          </button>
        ))}
      </div>

      <div className="frame-tabs">
        {frames.map((_, i) => (
          <button
            key={i}
            className={`retro-btn small ${frameIndex === i ? 'active' : ''}`}
            onClick={() => setFrameIndex(i)}
          >
            {i + 1}
          </button>
        ))}
        {frames.length < MAX_FRAMES && (
          <button className="retro-btn small" onClick={addFrame}>+</button>
        )}
      </div>

      <div className="pixel-tools">
        {(['pencil', 'eraser', 'fill'] as Tool[]).map((t) => (
          <button key={t} className={`retro-btn small ${tool === t ? 'active' : ''}`} onClick={() => setTool(t)}>
            {t === 'pencil' ? 'Lápiz' : t === 'eraser' ? 'Borrar' : 'Rellenar'}
          </button>
        ))}
        <button className="retro-btn small" onClick={duplicateFrame}>Dup</button>
        <button className="retro-btn small danger" onClick={removeFrame} disabled={frames.length <= 1}>−Frame</button>
        <button className="retro-btn small danger" onClick={clearFrame}>Limpiar</button>
        <label className="onion-toggle">
          <input type="checkbox" checked={onionSkin} onChange={(e) => setOnionSkin(e.target.checked)} />
          Onion
        </label>
        <label className="onion-toggle">
          <input type="checkbox" checked={clipLoop} onChange={(e) => {
            setClipLoop(e.target.checked);
            emitChange(frames, paletteSlots, fps, e.target.checked, activeClip, animations);
          }} />
          Loop
        </label>
        <label>
          FPS
          <input
            type="number"
            className="retro-input fps-input"
            min={1}
            max={24}
            value={fps}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFps(v);
              emitChange(frames, paletteSlots, v, clipLoop, activeClip, animations);
            }}
          />
        </label>
      </div>

      <canvas
        ref={canvasRef}
        width={width * pixelSize}
        height={height * pixelSize}
        className="pixel-canvas"
        onPointerDown={(e) => { pushUndo(); setIsDrawing(true); handlePointer(e); }}
        onPointerMove={(e) => isDrawing && handlePointer(e)}
        onPointerUp={() => setIsDrawing(false)}
        onPointerLeave={() => setIsDrawing(false)}
      />

      <div className="palette-section">
        <p className="palette-label">Subpaleta (16 slots)</p>
        <div className="palette-grid subpalette-grid">
          <button
            className={`palette-swatch ${selectedColor === 0 ? 'selected' : ''}`}
            style={{ background: '#1a1a2e', border: '2px dashed #666' }}
            onClick={() => { setSelectedColor(0); setSelectedSlot(0); }}
          />
          {Array.from({ length: 15 }, (_, i) => i + 1).map((slot) => (
            <button
              key={slot}
              className={`palette-swatch ${selectedColor === slot ? 'selected' : ''}`}
              style={{ background: paletteColor(paletteSlots[slot] ?? slot) }}
              onClick={() => { setSelectedColor(slot); setSelectedSlot(slot); }}
            />
          ))}
        </div>
      </div>

      <div className="palette-section">
        <p className="palette-label">Paleta SNES (64) — slot {selectedSlot || '—'}</p>
        <div className="snes-master-grid">
          {SNES_PALETTE.map((color, masterIdx) => (
            <button
              key={masterIdx}
              className="snes-swatch"
              style={{ background: color }}
              onClick={() => assignMasterToSlot(masterIdx)}
            />
          ))}
        </div>
      </div>
      <p className="hint">Ctrl+Z deshacer · Onion skin muestra frames adyacentes · Tamaños: {allowedSizes.join(', ')}px</p>
    </div>
  );
}

export function createEmptyAsset(
  category: AssetCategory,
  size?: number
): {
  pixels: number[];
  frames: number[][];
  paletteSlots: number[];
  width: number;
  height: number;
  fps: number;
  animations: Partial<Record<import('../types').AssetAnimClip, import('../types').AssetClipDef>>;
} {
  const s = size ?? DEFAULT_SIZES[category];
  const empty = new Array(s * s).fill(0);
  return {
    width: s as 8 | 16 | 32,
    height: s as 8 | 16 | 32,
    pixels: empty,
    frames: [empty],
    paletteSlots: [...DEFAULT_PALETTE_SLOTS],
    fps: 8,
    animations: {
      idle: { frames: [empty], fps: 8, loop: true },
    },
  };
}

export { validateAssetPixels };
