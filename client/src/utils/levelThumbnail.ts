import type { LevelSchema } from '../types';

export function renderLevelThumbnail(
  level: LevelSchema,
  width = 140,
  height = 80
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = level.backgroundColor || '#0a1020';
  ctx.fillRect(0, 0, width, height);

  const scaleX = width / level.width;
  const scaleY = height / level.height;
  const scale = Math.min(scaleX, scaleY);

  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = '#4a8a4a';
  for (const p of level.platforms) {
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }

  ctx.fillStyle = '#00d4ff';
  ctx.fillRect(level.spawn.x - 8, level.spawn.y - 8, 16, 16);

  const portal = level.portal;
  if (portal) {
    ctx.fillStyle = '#ff44aa';
    ctx.fillRect(
      portal.x - portal.w / 2,
      portal.y - portal.h / 2,
      portal.w,
      portal.h
    );
  }

  for (const e of level.enemies ?? []) {
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(e.x, e.y - 12);
    ctx.lineTo(e.x - 10, e.y + 10);
    ctx.lineTo(e.x + 10, e.y + 10);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  return canvas.toDataURL('image/png');
}
