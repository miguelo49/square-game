import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'square-game.db');

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);

  CREATE TABLE IF NOT EXISTS levels (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_levels_user ON levels(user_id);
`);

const levelCols = db.prepare('PRAGMA table_info(levels)').all() as Array<{ name: string }>;
if (!levelCols.some((c) => c.name === 'is_public')) {
  db.exec(`
    ALTER TABLE levels ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_levels_public ON levels(is_public);
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id);

  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_skills_user ON skills(user_id);

  CREATE TABLE IF NOT EXISTS music_tracks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_music_user ON music_tracks(user_id);
`);

export interface UserRow {
  id: string;
  nickname: string;
  password_hash: string;
  created_at: number;
}

export interface LevelRow {
  id: string;
  user_id: string;
  name: string;
  data: string;
  is_demo: number;
  is_public?: number;
  created_at: number;
  updated_at: number;
}

export interface AssetRow {
  id: string;
  user_id: string;
  name: string;
  data: string;
  created_at: number;
}

export interface SkillRow {
  id: string;
  user_id: string;
  name: string;
  data: string;
  created_at: number;
}

export interface MusicTrackRow {
  id: string;
  user_id: string;
  name: string;
  data: string;
  created_at: number;
}
