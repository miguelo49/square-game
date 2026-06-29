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
  return DOM_TO_PHASER[key] ?? key;
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
] as const;
