import type { MusicSchema, MusicNote } from '../types';

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const MINOR_PENTA = [0, 3, 5, 7, 10];

function noteFreqFromMidi(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

type WaveType = 'square' | 'triangle';

interface NoteEvent {
  start: number;
  duration: number;
  freq: number;
  gain: number;
  wave: WaveType;
}

function synthNote(
  output: Float32Array,
  sampleRate: number,
  event: NoteEvent
): void {
  const startSample = Math.floor(event.start * sampleRate);
  const endSample = Math.min(
    output.length,
    startSample + Math.floor(event.duration * sampleRate)
  );
  const attack = Math.floor(0.01 * sampleRate);
  const release = Math.floor(0.05 * sampleRate);
  const total = endSample - startSample;

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / sampleRate;
    const phase = (t * event.freq) % 1;
    let sample =
      event.wave === 'square'
        ? phase < 0.5
          ? 1
          : -1
        : phase < 0.5
          ? 4 * phase - 1
          : 3 - 4 * phase;

    const local = i - startSample;
    let env = event.gain;
    if (local < attack) env *= local / attack;
    if (local > total - release) env *= (total - local) / release;

    output[i] += sample * env;
  }
}

function noteFreq(rootHz: number, semitone: number): number {
  return rootHz * Math.pow(2, semitone / 12);
}

function renderEvents(
  ctx: AudioContext,
  events: NoteEvent[],
  durationSec: number
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(durationSec * sampleRate);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const channel = buffer.getChannelData(ch);
    for (const ev of events) {
      synthNote(channel, sampleRate, ev);
    }
    let peak = 0;
    for (let i = 0; i < channel.length; i++) {
      peak = Math.max(peak, Math.abs(channel[i]!));
    }
    if (peak > 0.9) {
      const scale = 0.85 / peak;
      for (let i = 0; i < channel.length; i++) channel[i]! *= scale;
    }
  }

  return buffer;
}

export function schemaToEvents(schema: MusicSchema): NoteEvent[] {
  const beatDur = 60 / schema.bpm;
  const voiceGains = [0.12, 0.1, 0.08, 0.08];
  const events: NoteEvent[] = [];

  for (const note of schema.notes) {
    const gain = voiceGains[note.voice] ?? 0.08;
    events.push({
      start: note.startBeat * beatDur,
      duration: note.duration * beatDur,
      freq: noteFreqFromMidi(note.pitch),
      gain,
      wave: note.wave,
    });
  }

  return events.sort((a, b) => a.start - b.start);
}

export function generateFromSchema(schema: MusicSchema, ctx: AudioContext): AudioBuffer {
  const beatDur = 60 / schema.bpm;
  const duration = schema.bars * 4 * beatDur;
  const events = schemaToEvents(schema);
  return renderEvents(ctx, events, duration);
}

export function generateLoop(seed: number, ctx: AudioContext): AudioBuffer {
  const rand = seededRandom(seed);
  const bpm = 130 + Math.floor(rand() * 20);
  const bars = 4 + Math.floor(rand() * 4);
  const beatDur = 60 / bpm;
  const duration = bars * 4 * beatDur;
  const rootHz = 110 * Math.pow(2, Math.floor(rand() * 5) / 12);
  const voiceCount = 2 + Math.floor(rand() * 3);
  const events: NoteEvent[] = [];

  for (let v = 0; v < voiceCount; v++) {
    const wave: WaveType = rand() > 0.5 ? 'square' : 'triangle';
    const gain = 0.08 / voiceCount;
    const octave = Math.floor(rand() * 2);
    const stepsPerBar = rand() > 0.5 ? 4 : 8;

    for (let bar = 0; bar < bars; bar++) {
      for (let step = 0; step < stepsPerBar; step++) {
        if (rand() > 0.35) continue;
        const degree = MINOR_PENTA[Math.floor(rand() * MINOR_PENTA.length)]!;
        const semitone = degree + octave * 12 + (v % 2 === 0 ? 0 : 12);
        const start = (bar * 4 + (step * 4) / stepsPerBar) * beatDur;
        const noteDur = beatDur * (4 / stepsPerBar) * 0.85;
        events.push({
          start,
          duration: noteDur,
          freq: noteFreq(rootHz, semitone),
          gain,
          wave,
        });
      }
    }
  }

  return renderEvents(ctx, events, duration);
}

export function emptyMusicSchema(): MusicSchema {
  return { bpm: 130, bars: 4, notes: [] };
}

export const PITCH_MIN = 48;
export const PITCH_MAX = 84;
export const VOICE_COUNT = 4;
export const STEPS_PER_BEAT = 4;

export function noteLabel(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[midi % 12]}${octave}`;
}

export function findNoteAt(
  notes: MusicNote[],
  voice: number,
  pitch: number,
  startBeat: number
): MusicNote | undefined {
  return notes.find(
    (n) =>
      n.voice === voice &&
      n.pitch === pitch &&
      Math.abs(n.startBeat - startBeat) < 0.001
  );
}
