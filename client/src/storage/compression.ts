import { gzip, ungzip } from 'pako';
import type { AssetSchema, LevelSchema, MusicTrackExport } from '../types';

export function compressLevel(level: LevelSchema): Uint8Array {
  const json = JSON.stringify(level);
  return gzip(json);
}

export function decompressLevel(data: Uint8Array): LevelSchema {
  const json = ungzip(data, { to: 'string' });
  return JSON.parse(json) as LevelSchema;
}

export function exportSqlevel(level: LevelSchema): Blob {
  const compressed = compressLevel(level);
  return new Blob([compressed as BlobPart], { type: 'application/octet-stream' });
}

export async function importSqlevel(file: File): Promise<LevelSchema> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  return decompressLevel(buffer);
}

export function downloadSqlevel(level: LevelSchema, filename: string): void {
  const blob = exportSqlevel(level);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.sqlevel') ? filename : `${filename}.sqlevel`;
  a.click();
  URL.revokeObjectURL(url);
}

export function estimateLevelSize(level: LevelSchema): number {
  return JSON.stringify(level).length;
}

export function exportSqmusic(track: MusicTrackExport): Blob {
  const compressed = gzip(JSON.stringify(track));
  return new Blob([compressed as BlobPart], { type: 'application/octet-stream' });
}

export async function importSqmusic(file: File): Promise<MusicTrackExport> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const json = ungzip(buffer, { to: 'string' });
  return JSON.parse(json) as MusicTrackExport;
}

export function downloadSqmusic(track: MusicTrackExport, filename: string): void {
  const blob = exportSqmusic(track);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.sqmusic') ? filename : `${filename}.sqmusic`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface AssetExport {
  name: string;
  data: AssetSchema;
}

export function exportSqasset(asset: AssetSchema, assetName: string): Blob {
  const payload: AssetExport = { name: assetName, data: asset };
  const compressed = gzip(JSON.stringify(payload));
  return new Blob([compressed as BlobPart], { type: 'application/octet-stream' });
}

export async function importSqasset(file: File): Promise<AssetExport> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const json = ungzip(buffer, { to: 'string' });
  return JSON.parse(json) as AssetExport;
}

export function downloadSqasset(asset: AssetSchema, filename: string): void {
  const blob = exportSqasset(asset, asset.name ?? filename);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.sqasset') ? filename : `${filename}.sqasset`;
  a.click();
  URL.revokeObjectURL(url);
}

export function collectLevelAssetIds(level: LevelSchema): string[] {
  const ids = new Set<string>();
  for (const p of level.platforms) {
    if (p.assetId) ids.add(p.assetId);
  }
  for (const e of level.enemies) {
    if (e.assetId) ids.add(e.assetId);
  }
  return Array.from(ids);
}

export function embedLevelAssets(level: LevelSchema, assets: AssetSchema[]): LevelSchema {
  const ids = collectLevelAssetIds(level);
  const embedded = assets.filter((a) => ids.includes(a.id));
  if (embedded.length === 0) {
    const { embeddedAssets: _, ...rest } = level;
    return rest as LevelSchema;
  }
  return { ...level, embeddedAssets: embedded };
}

export function mergeEmbeddedAssets(
  level: LevelSchema,
  existing: AssetSchema[]
): { level: LevelSchema; mergedAssets: AssetSchema[]; missingIds: string[] } {
  const embedded = level.embeddedAssets ?? [];
  const map = new Map<string, AssetSchema>();
  for (const a of existing) map.set(a.id, a);
  for (const a of embedded) map.set(a.id, a);
  const mergedAssets = Array.from(map.values());
  const missingIds = collectLevelAssetIds(level).filter((id) => !map.has(id));
  const { embeddedAssets: _, ...rest } = level;
  return { level: rest as LevelSchema, mergedAssets, missingIds };
}
