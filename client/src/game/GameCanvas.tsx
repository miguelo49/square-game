import { useEffect, useRef, useMemo } from 'react';
import Phaser from 'phaser';
import { createPhaserConfig } from './PhaserGame';
import { GameScene } from './scenes/GameScene';
import { MusicPlayer } from '../audio/MusicPlayer';
import type { LevelSchema, SkillSchema, AssetSchema, GameMode, SelectedEnemyConfig, RunResult } from '../types';
import type { MusicTrackRef } from '../hooks/useGameContent';
import { mergeById } from '../utils/mergeContent';

interface GameCanvasProps {
  level: LevelSchema;
  skills?: SkillSchema[];
  assets?: AssetSchema[];
  extraAssets?: AssetSchema[];
  mode?: GameMode;
  playtest?: boolean;
  editorTool?: string;
  selectedEnemy?: SelectedEnemyConfig;
  selectedEntityId?: string | null;
  defaultPlatformPreset?: string;
  showGrid?: boolean;
  onLevelChange?: (level: LevelSchema) => void;
  onEditorSelect?: (type: string, id: string) => void;
  onCursorMove?: (x: number, y: number) => void;
  onCameraChange?: (x: number, y: number, zoom: number) => void;
  onDeath?: () => void;
  onWin?: (result: RunResult) => void;
  musicTracks?: MusicTrackRef[];
}

export function GameCanvas({
  level,
  skills = [],
  assets = [],
  extraAssets = [],
  mode = 'play',
  playtest = false,
  editorTool = 'select',
  selectedEnemy,
  selectedEntityId,
  defaultPlatformPreset = 'static',
  showGrid = true,
  onLevelChange,
  onEditorSelect,
  onCursorMove,
  onCameraChange,
  onDeath,
  onWin,
  musicTracks = [],
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const musicRef = useRef<MusicPlayer | null>(null);
  const bootedRef = useRef(false);
  const mergedAssets = useMemo(() => mergeById(assets, extraAssets), [assets, extraAssets]);
  const assetsKey = useMemo(() => mergedAssets.map((a) => a.id).join(','), [mergedAssets]);

  const propsRef = useRef({
    level,
    skills,
    assets: mergedAssets,
    mode,
    editorTool,
    selectedEnemy,
    selectedEntityId,
    defaultPlatformPreset,
    showGrid,
    onDeath,
    onWin,
    onEditorSelect,
    onCursorMove,
    onCameraChange,
  });

  propsRef.current = {
    level,
    skills,
    assets: mergedAssets,
    mode,
    editorTool,
    selectedEnemy,
    selectedEntityId,
    defaultPlatformPreset,
    showGrid,
    onDeath,
    onWin,
    onEditorSelect,
    onCursorMove,
    onCameraChange,
  };

  const levelKey = useMemo(() => JSON.stringify(level), [level]);
  const skillsKey = useMemo(() => skills.map((s) => s.id).join(','), [skills]);
  const prevModeRef = useRef(mode);

  useEffect(() => {
    if (!containerRef.current) return;

    const parent = containerRef.current;
    const config = createPhaserConfig(parent);
    config.scene = [GameScene];
    const game = new Phaser.Game(config);
    gameRef.current = game;
    bootedRef.current = false;

    const startScene = () => {
      bootedRef.current = true;
      const p = propsRef.current;
      game.scene.start('GameScene', {
        level: p.level,
        skills: p.skills,
        assets: p.assets,
        mode: p.mode,
        editorTool: p.editorTool,
        selectedEnemy: p.selectedEnemy,
        selectedEntityId: p.selectedEntityId,
        defaultPlatformPreset: p.defaultPlatformPreset,
        showGrid: p.showGrid,
        callbacks: {
          onDeath: () => propsRef.current.onDeath?.(),
          onWin: (result: RunResult) => propsRef.current.onWin?.(result),
          onEditorSelect: (type: string, id: string) =>
            propsRef.current.onEditorSelect?.(type, id),
          onCursorMove: (x: number, y: number) =>
            propsRef.current.onCursorMove?.(x, y),
          onCameraChange: (x: number, y: number, zoom: number) =>
            propsRef.current.onCameraChange?.(x, y, zoom),
        },
      });
    };

    if (game.isBooted) startScene();
    else game.events.once('ready', startScene);

    if (onLevelChange) {
      game.events.on('level-changed', onLevelChange);
    }

    const handleResize = () => {
      game.scale.resize(parent.clientWidth, parent.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(handleResize);
    ro.observe(parent);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      if (onLevelChange) game.events.off('level-changed', onLevelChange);
      game.destroy(true);
      gameRef.current = null;
      bootedRef.current = false;
    };
  }, [onLevelChange]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game?.isBooted || !bootedRef.current) return;

    const p = propsRef.current;
    const scene = game.scene.getScene('GameScene') as GameScene | undefined;
    const modeChanged = prevModeRef.current !== mode;
    prevModeRef.current = mode;

    if (scene?.scene.isActive() && !modeChanged) {
      scene.events.emit('update-level', p.level);
      scene.events.emit('set-tool', p.editorTool);
      scene.events.emit('set-selected-entity', p.selectedEntityId ?? null);
      scene.events.emit('set-grid-visible', p.showGrid);
      return;
    }

    const payload = {
      level: p.level,
      skills: p.skills,
      assets: p.assets,
      mode: p.mode,
      editorTool: p.editorTool,
      selectedEnemy: p.selectedEnemy,
      selectedEntityId: p.selectedEntityId,
      defaultPlatformPreset: p.defaultPlatformPreset,
      showGrid: p.showGrid,
      callbacks: {
        onDeath: () => propsRef.current.onDeath?.(),
        onWin: (result: RunResult) => propsRef.current.onWin?.(result),
        onEditorSelect: (type: string, id: string) =>
          propsRef.current.onEditorSelect?.(type, id),
        onCursorMove: (x: number, y: number) =>
          propsRef.current.onCursorMove?.(x, y),
        onCameraChange: (x: number, y: number, zoom: number) =>
          propsRef.current.onCameraChange?.(x, y, zoom),
      },
    };

    if (scene?.scene.isActive()) {
      scene.scene.restart(payload);
    } else {
      game.scene.start('GameScene', payload);
    }
  }, [levelKey, skillsKey, assetsKey, mode, editorTool, defaultPlatformPreset, showGrid]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game?.isBooted) return;
    const scene = game.scene.getScene('GameScene');
    scene?.events.emit('set-selected-enemy', selectedEnemy);
  }, [selectedEnemy]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game?.isBooted) return;
    const scene = game.scene.getScene('GameScene');
    scene?.events.emit('set-selected-entity', selectedEntityId ?? null);
  }, [selectedEntityId]);

  useEffect(() => {
    if (!musicRef.current) musicRef.current = new MusicPlayer();
    const player = musicRef.current;

    if (mode === 'play' && !playtest) {
      const track = level.musicTrackId
        ? musicTracks.find((t) => t.id === level.musicTrackId)
        : undefined;
      if (track) {
        void player.playSchema(track.data);
      } else if (level.music) {
        void player.playSchema(level.music);
      } else if (level.musicSeed != null) {
        void player.play(level.musicSeed);
      } else {
        player.stop();
      }
    } else if (mode === 'play' && playtest) {
      if (level.music) void player.playSchema(level.music);
      else if (level.musicSeed != null) void player.play(level.musicSeed);
      else player.stop();
    } else {
      player.stop();
    }

    return () => player.stop();
  }, [mode, playtest, level.music, level.musicSeed, level.musicTrackId, musicTracks]);

  return (
    <div
      ref={containerRef}
      className="game-canvas"
      tabIndex={0}
      onPointerDown={() => containerRef.current?.focus()}
    />
  );
}
