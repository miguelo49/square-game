import { generateLoop, generateFromSchema } from './PolyMusicGenerator';
import type { MusicSchema } from '../types';

export class MusicPlayer {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private currentKey: string | null = null;

  async play(seed: number): Promise<void> {
    const key = `seed:${seed}`;
    if (this.currentKey === key && this.source) return;
    this.stop();
    this.ctx = new AudioContext();
    this.currentKey = key;
    const buffer = generateLoop(seed, this.ctx);
    this.startBuffer(buffer);
  }

  async playSchema(schema: MusicSchema): Promise<void> {
    const key = `schema:${schema.bpm}:${schema.bars}:${schema.notes.length}`;
    if (this.currentKey === key && this.source) return;
    this.stop();
    this.ctx = new AudioContext();
    this.currentKey = key;
    const buffer = generateFromSchema(schema, this.ctx);
    this.startBuffer(buffer);
  }

  private startBuffer(buffer: AudioBuffer): void {
    if (!this.ctx) return;
    this.source = this.ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;
    this.source.connect(this.ctx.destination);
    this.source.start(0);
  }

  stop(): void {
    try {
      this.source?.stop();
    } catch {
      /* already stopped */
    }
    this.source = null;
    void this.ctx?.close();
    this.ctx = null;
    this.currentKey = null;
  }
}

export function previewSchema(schema: MusicSchema): MusicPlayer {
  const player = new MusicPlayer();
  void player.playSchema(schema);
  return player;
}

export function previewSeed(seed: number): MusicPlayer {
  const player = new MusicPlayer();
  void player.play(seed);
  return player;
}
