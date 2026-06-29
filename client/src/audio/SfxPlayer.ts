let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = 'square', vol = 0.08) {
  if (muted) return;
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration);
}

export const Sfx = {
  setMuted(m: boolean) {
    muted = m;
  },
  isMuted() {
    return muted;
  },
  jump() {
    tone(440, 0.08, 'square', 0.06);
  },
  hurt() {
    tone(120, 0.15, 'sawtooth', 0.1);
  },
  win() {
    tone(523, 0.1, 'square', 0.07);
    setTimeout(() => tone(659, 0.1, 'square', 0.07), 100);
    setTimeout(() => tone(784, 0.2, 'square', 0.07), 200);
  },
  portal() {
    tone(880, 0.12, 'triangle', 0.06);
  },
  coin() {
    tone(987, 0.06, 'square', 0.05);
  },
};
