export function formatTimeMs(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const cs = Math.floor((ms % 1000) / 10);
  return `${min}:${sec.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

export function mergeById<T extends { id: string }>(own: T[], pub: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of pub) map.set(item.id, item);
  for (const item of own) map.set(item.id, item);
  return Array.from(map.values());
}
