import type { PlatformDef } from '../../types';

const SNAP_TOLERANCE = 8;

function verticalOverlap(a: PlatformDef, b: PlatformDef): boolean {
  return a.y < b.y + b.h && a.y + a.h > b.y;
}

function horizontalOverlap(a: PlatformDef, b: PlatformDef): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

export function snapPlatformAdjacent(
  p: PlatformDef,
  platforms: PlatformDef[],
  tolerance = SNAP_TOLERANCE
): { x: number; y: number } {
  let { x, y } = p;

  for (const other of platforms) {
    if (other.id === p.id) continue;

    if (verticalOverlap(p, other)) {
      const rightToLeft = Math.abs(x + p.w - other.x);
      if (rightToLeft <= tolerance) x = other.x - p.w;

      const leftToRight = Math.abs(x - (other.x + other.w));
      if (leftToRight <= tolerance) x = other.x + other.w;

      const alignTop = Math.abs(y - other.y);
      if (alignTop <= tolerance) y = other.y;

      const alignBottom = Math.abs(y + p.h - (other.y + other.h));
      if (alignBottom <= tolerance) y = other.y + other.h - p.h;
    }

    if (horizontalOverlap(p, other)) {
      const bottomToTop = Math.abs(y + p.h - other.y);
      if (bottomToTop <= tolerance) y = other.y - p.h;

      const topToBottom = Math.abs(y - (other.y + other.h));
      if (topToBottom <= tolerance) y = other.y + other.h;

      const alignLeft = Math.abs(x - other.x);
      if (alignLeft <= tolerance) x = other.x;

      const alignRight = Math.abs(x + p.w - (other.x + other.w));
      if (alignRight <= tolerance) x = other.x + other.w - p.w;
    }
  }

  return { x, y };
}
