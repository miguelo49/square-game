import { useEffect, useRef, useMemo } from 'react';
import Phaser from 'phaser';
import { createPhaserConfig } from './PhaserGame';
import { GameScene } from './scenes/GameScene';
import { MusicPlayer } from '../audio/MusicPlayer';
import type { LevelSchema, SkillSchema, AssetSchema, GameMode, SelectedEnemyConfig, RunResult } from '../types';
import type { MusicTrackRef } from '../hooks/useGameContent';

interface GameCanvasProps {
  level: LevelSchema;
  skills?: SkillSchema[];
  assets?: AssetSchema[];
  mode?: GameMode;
  editorTool?: string;
  selectedEnemy?: SelectedEnemyConfig;
  selectedEntityId?: string | null;
  onLevelChange?: (level: LevelSchema) => void;
  onEditorSelect?: (type: string, id: string) => void;
  onDeath?: () => void;
  onWin?: (result: RunResult) => void;
  musicTracks?: MusicTrackRef[];
}

export function GameCanvas({
  level,
  skills = [],
  assets = [],
  mode = 'play',
  editorTool = 'select',
  selectedEnemy,
  selectedEntityId,
  onLevelChange,
  onEditorSelect,
  onDeath,
  onWin,
  musicTracks = [],
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const musicRef = useRef<MusicPlayer | null>(null);
  const bootedRef = useRef(false);
  const propsRef = useRef({
    level,
    skills,
    assets,
    mode,
    editorTool,
    selectedEnemy,
    selectedEntityId,
    onDeath,
    onWin,
    onEditorSelect,
  });

  propsRef.current = {
    level,
    skills,
    assets,
    mode,
    editorTool,
    selectedEnemy,
    selectedEntityId,
    onDeath,
    onWin,
    onEditorSelect,
  };

  const levelKey = useMemo(() => JSON.stringify(level), [level]);
  const skillsKey = useMemo(
    () => skills.map((s) => s.id).join(','),
    [skills]
  );
  const assetsKey = useMemo(
    () => assets.map((a) => a.id).join(','),
    [assets]
  );

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
        callbacks: {
          onDeath: () => propsRef.current.onDeath?.(),
          onWin: (result: RunResult) => propsRef.current.onWin?.(result),
          onEditorSelect: (type: string, id: string) =>
            propsRef.current.onEditorSelect?.(type, id),
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
    const scene = game.scene.getScene('GameScene');
    const payload = {
      level: p.level,
      skills: p.skills,
      assets: p.assets,
      mode: p.mode,
      editorTool: p.editorTool,
      selectedEnemy: p.selectedEnemy,
      selectedEntityId: p.selectedEntityId,
      callbacks: {
        onDeath: () => propsRef.current.onDeath?.(),
        onWin: (result: RunResult) => propsRef.current.onWin?.(result),
        onEditorSelect: (type: string, id: string) =>
          propsRef.current.onEditorSelect?.(type, id),
      },
    };

    if (scene?.scene.isActive()) {
      scene.scene.restart(payload);
    } else {
      game.scene.start('GameScene', payload);
    }
  }, [levelKey, skillsKey, assetsKey, mode, editorTool]);

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

    if (mode === 'play') {
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
    } else {
      player.stop();
    }

    return () => player.stop();
  }, [mode, level.music, level.musicSeed, level.musicTrackId, musicTracks]);

  return (
    <div
      ref={containerRef}
      className="game-canvas"
      tabIndex={0}
      onPointerDown={() => containerRef.current?.focus()}
    />
  );
}
