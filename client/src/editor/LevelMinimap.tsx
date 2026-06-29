import { useRef, useEffect } from 'react';
import type { LevelSchema } from '../types';

interface LevelMinimapProps {
  level: LevelSchema;
  cameraX: number;
  cameraY: number;
  viewW: number;
  viewH: number;
  zoom: number;
  onPan: (worldX: number, worldY: number) => void;
}

const W = 120;
const H = 68;

export function LevelMinimap({
  level,
  cameraX,
  cameraY,
  viewW,
  viewH,
  zoom,
  onPan,
}: LevelMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = level.backgroundColor || '#0a1020';
    ctx.fillRect(0, 0, W, H);

    const sx = W / level.width;
    const sy = H / level.height;
    const s = Math.min(sx, sy);

    ctx.fillStyle = '#4a8a4a';
    for (const p of level.platforms) {
      ctx.fillRect(p.x * s, p.y * s, p.w * s, p.h * s);
    }

    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1;
    const vx = cameraX * s;
    const vy = cameraY * s;
    const vw = (viewW / zoom) * s;
    const vh = (viewH / zoom) * s;
    ctx.strokeRect(vx, vy, vw, vh);
  }, [level, cameraX, cameraY, viewW, viewH, zoom]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = Math.min(W / level.width, H / level.height);
    onPan(x / s, y / s);
  };

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="minimap"
      onClick={handleClick}
      title="Minimapa — click para mover cámara"
    />
  );
}
