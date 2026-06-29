import { useCallback, useRef, useState } from 'react';
import type { LevelSchema } from '../types';

const MAX_HISTORY = 50;

export function useLevelHistory(initial: LevelSchema) {
  const [level, setLevelState] = useState(initial);
  const undoStack = useRef<LevelSchema[]>([]);
  const redoStack = useRef<LevelSchema[]>([]);
  const skipPush = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBefore = useRef<LevelSchema | null>(null);

  const pushSnapshot = useCallback((before: LevelSchema) => {
    undoStack.current.push(JSON.parse(JSON.stringify(before)));
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const setLevel = useCallback(
    (next: LevelSchema | ((prev: LevelSchema) => LevelSchema), recordHistory = true) => {
      setLevelState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (recordHistory && !skipPush.current) {
          pushSnapshot(prev);
        }
        skipPush.current = false;
        return resolved;
      });
    },
    [pushSnapshot]
  );

  const setLevelDebounced = useCallback(
    (next: LevelSchema) => {
      if (!pendingBefore.current) {
        pendingBefore.current = JSON.parse(JSON.stringify(level));
      }
      setLevelState(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (pendingBefore.current) {
          pushSnapshot(pendingBefore.current);
          pendingBefore.current = null;
        }
      }, 300);
    },
    [level, pushSnapshot]
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return false;
    redoStack.current.push(JSON.parse(JSON.stringify(level)));
    skipPush.current = true;
    setLevelState(prev);
    return true;
  }, [level]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return false;
    undoStack.current.push(JSON.parse(JSON.stringify(level)));
    skipPush.current = true;
    setLevelState(next);
    return true;
  }, [level]);

  const resetHistory = useCallback((snapshot: LevelSchema) => {
    undoStack.current = [];
    redoStack.current = [];
    pendingBefore.current = null;
    skipPush.current = true;
    setLevelState(snapshot);
  }, []);

  return {
    level,
    setLevel,
    setLevelDebounced,
    undo,
    redo,
    resetHistory,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
