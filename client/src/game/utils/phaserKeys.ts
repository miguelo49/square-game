import Phaser from 'phaser';

/** Maps DOM KeyboardEvent.code / legacy values to Phaser KeyCodes names */
const DOM_TO_PHASER: Record<string, string> = {
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  KeyA: 'A',
  KeyB: 'B',
  KeyC: 'C',
  KeyD: 'D',
  KeyW: 'W',
  KeyS: 'S',
  KeyZ: 'Z',
  KeyX: 'X',
  Space: 'SPACE',
  ShiftLeft: 'SHIFT',
  ShiftRight: 'SHIFT',
};

export function toPhaserKey(key: string): string {
  if (DOM_TO_PHASER[key]) return DOM_TO_PHASER[key]!;
  const upper = key.toUpperCase();
  return upper;
}

export function resolvePhaserKeyCode(key: string): number {
  const name = toPhaserKey(key);
  const codes = Phaser.Input.Keyboard.KeyCodes as Record<string, number>;
  return codes[name] ?? codes[key] ?? codes.SPACE;
}

export const GAME_CAPTURE_KEYS = [
  'LEFT',
  'RIGHT',
  'UP',
  'DOWN',
  'SPACE',
  'A',
  'D',
  'W',
  'S',
  'SHIFT',
  'Z',
  'X',
] as const;
