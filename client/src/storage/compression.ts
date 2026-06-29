import { gzip, ungzip } from 'pako';
import type { LevelSchema, MusicTrackExport } from '../types';

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
