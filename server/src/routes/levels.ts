import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { requireAuth } from '../auth/routes.js';
import { canPlayLevel } from './levelAccess.js';

const MIN_TIME_MS = 500;
const MAX_TIME_MS = 3_600_000;

export async function levelRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/api/levels', async (request) => {
    const userId = request.user!.userId;
    const rows = db
      .prepare(
        `SELECT id, name, data, is_demo, is_public, created_at, updated_at FROM levels
         WHERE user_id = ? OR is_demo = 1
         ORDER BY is_demo DESC, updated_at DESC`
      )
      .all(userId) as Array<{
      id: string;
      name: string;
      data: string;
      is_demo: number;
      is_public: number;
      created_at: number;
      updated_at: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      data: JSON.parse(r.data),
      isDemo: r.is_demo === 1,
      isPublic: r.is_public === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  });

  app.get('/api/levels/public', async () => {
    const rows = db
      .prepare(
        `SELECT l.id, l.name, l.data, l.updated_at, u.nickname AS author_nickname
         FROM levels l
         JOIN users u ON u.id = l.user_id
         WHERE l.is_public = 1 AND l.is_demo = 0
         ORDER BY l.updated_at DESC
         LIMIT 100`
      )
      .all() as Array<{
      id: string;
      name: string;
      data: string;
      updated_at: number;
      author_nickname: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      data: JSON.parse(r.data),
      authorNickname: r.author_nickname,
      updatedAt: r.updated_at,
    }));
  });

  app.get('/api/levels/favorites', async (request) => {
    const userId = request.user!.userId;
    const rows = db
      .prepare(
        `SELECT l.id, l.name, l.data, l.is_demo, l.is_public, f.created_at, u.nickname AS author_nickname
         FROM level_favorites f
         JOIN levels l ON l.id = f.level_id
         JOIN users u ON u.id = l.user_id
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC`
      )
      .all(userId) as Array<{
      id: string;
      name: string;
      data: string;
      is_demo: number;
      is_public: number;
      created_at: number;
      author_nickname: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      data: JSON.parse(r.data),
      isDemo: r.is_demo === 1,
      isPublic: r.is_public === 1,
      authorNickname: r.author_nickname,
      favoritedAt: r.created_at,
    }));
  });

  app.get<{ Params: { id: string } }>(
    '/api/levels/:id/leaderboard',
    async (request, reply) => {
      const userId = request.user!.userId;
      if (!canPlayLevel(request.params.id, userId)) {
        return reply.code(404).send({ error: 'Nivel no encontrado' });
      }

      const rows = db
        .prepare(
          `SELECT u.nickname, s.time_ms, s.deaths, s.achieved_at
           FROM level_best_scores s
           JOIN users u ON u.id = s.user_id
           WHERE s.level_id = ?
           ORDER BY s.time_ms ASC
           LIMIT 20`
        )
        .all(request.params.id) as Array<{
        nickname: string;
        time_ms: number;
        deaths: number;
        achieved_at: number;
      }>;

      return rows.map((r, i) => ({
        rank: i + 1,
        nickname: r.nickname,
        timeMs: r.time_ms,
        deaths: r.deaths,
        achievedAt: r.achieved_at,
      }));
    }
  );

  app.get<{ Params: { id: string } }>(
    '/api/levels/:id/score/me',
    async (request, reply) => {
      const userId = request.user!.userId;
      if (!canPlayLevel(request.params.id, userId)) {
        return reply.code(404).send({ error: 'Nivel no encontrado' });
      }

      const row = db
        .prepare(
          `SELECT time_ms, deaths, achieved_at FROM level_best_scores
           WHERE level_id = ? AND user_id = ?`
        )
        .get(request.params.id, userId) as
        | { time_ms: number; deaths: number; achieved_at: number }
        | undefined;

      if (!row) return { timeMs: null, deaths: null, achievedAt: null };

      return {
        timeMs: row.time_ms,
        deaths: row.deaths,
        achievedAt: row.achieved_at,
      };
    }
  );

  app.post<{ Params: { id: string }; Body: { timeMs?: number; deaths?: number } }>(
    '/api/levels/:id/score',
    async (request, reply) => {
      const userId = request.user!.userId;
      const levelId = request.params.id;
      if (!canPlayLevel(levelId, userId)) {
        return reply.code(404).send({ error: 'Nivel no encontrado' });
      }

      const { timeMs, deaths = 0 } = request.body ?? {};
      if (typeof timeMs !== 'number' || timeMs < MIN_TIME_MS || timeMs > MAX_TIME_MS) {
        return reply.code(400).send({ error: 'timeMs inválido' });
      }

      const existing = db
        .prepare(
          'SELECT time_ms FROM level_best_scores WHERE level_id = ? AND user_id = ?'
        )
        .get(levelId, userId) as { time_ms: number } | undefined;

      const now = Math.floor(Date.now() / 1000);
      let isPersonalBest = false;

      if (!existing) {
        db.prepare(
          `INSERT INTO level_best_scores (level_id, user_id, time_ms, deaths, achieved_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(levelId, userId, timeMs, deaths, now);
        isPersonalBest = true;
      } else if (timeMs < existing.time_ms) {
        db.prepare(
          `UPDATE level_best_scores SET time_ms = ?, deaths = ?, achieved_at = ?
           WHERE level_id = ? AND user_id = ?`
        ).run(timeMs, deaths, now, levelId, userId);
        isPersonalBest = true;
      }

      const rankRow = db
        .prepare(
          `SELECT COUNT(*) + 1 AS rank FROM level_best_scores
           WHERE level_id = ? AND time_ms < ?`
        )
        .get(levelId, timeMs) as { rank: number };

      return {
        isPersonalBest,
        rank: rankRow.rank,
        inTop20: rankRow.rank <= 20,
      };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/levels/:id/favorite',
    async (request, reply) => {
      const userId = request.user!.userId;
      const levelId = request.params.id;
      if (!canPlayLevel(levelId, userId)) {
        return reply.code(404).send({ error: 'Nivel no encontrado' });
      }

      const existing = db
        .prepare('SELECT 1 FROM level_favorites WHERE user_id = ? AND level_id = ?')
        .get(userId, levelId);

      if (existing) {
        db.prepare('DELETE FROM level_favorites WHERE user_id = ? AND level_id = ?').run(
          userId,
          levelId
        );
        return { isFavorite: false };
      }

      db.prepare(
        'INSERT INTO level_favorites (user_id, level_id) VALUES (?, ?)'
      ).run(userId, levelId);
      return { isFavorite: true };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/levels/:id/share',
    async (request, reply) => {
      const userId = request.user!.userId;
      const row = db
        .prepare(
          'SELECT id, is_demo, is_public FROM levels WHERE id = ? AND user_id = ?'
        )
        .get(request.params.id, userId) as
        | { id: string; is_demo: number; is_public: number }
        | undefined;

      if (!row) return reply.code(404).send({ error: 'Nivel no encontrado' });
      if (row.is_demo === 1) {
        return reply.code(400).send({ error: 'No se puede compartir el demo' });
      }

      const nextPublic = row.is_public === 1 ? 0 : 1;
      const now = Math.floor(Date.now() / 1000);
      db.prepare(
        'UPDATE levels SET is_public = ?, updated_at = ? WHERE id = ?'
      ).run(nextPublic, now, request.params.id);

      return { isPublic: nextPublic === 1 };
    }
  );

  app.get<{ Params: { id: string } }>('/api/levels/:id', async (request, reply) => {
    const userId = request.user!.userId;
    if (!canPlayLevel(request.params.id, userId)) {
      return reply.code(404).send({ error: 'Nivel no encontrado' });
    }

    const row = db
      .prepare(
        `SELECT id, name, data, is_demo, is_public FROM levels WHERE id = ?`
      )
      .get(request.params.id) as
      | { id: string; name: string; data: string; is_demo: number; is_public: number }
      | undefined;

    if (!row) return reply.code(404).send({ error: 'Nivel no encontrado' });

    const fav = db
      .prepare('SELECT 1 FROM level_favorites WHERE user_id = ? AND level_id = ?')
      .get(userId, request.params.id);

    return {
      id: row.id,
      name: row.name,
      data: JSON.parse(row.data),
      isDemo: row.is_demo === 1,
      isPublic: row.is_public === 1,
      isFavorite: !!fav,
    };
  });

  app.post<{ Body: { name?: string; data?: unknown } }>(
    '/api/levels',
    async (request, reply) => {
      const userId = request.user!.userId;
      const { name, data } = request.body ?? {};

      if (!name || !data) {
        return reply.code(400).send({ error: 'name y data requeridos' });
      }

      const count = db
        .prepare('SELECT COUNT(*) as c FROM levels WHERE user_id = ?')
        .get(userId) as { c: number };
      if (count.c >= 100) {
        return reply.code(400).send({ error: 'Máximo 100 niveles por usuario' });
      }

      const id = uuidv4();
      const now = Math.floor(Date.now() / 1000);
      db.prepare(
        'INSERT INTO levels (id, user_id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, userId, name, JSON.stringify(data), now, now);

      return { id, name, data };
    }
  );

  app.put<{ Params: { id: string }; Body: { name?: string; data?: unknown } }>(
    '/api/levels/:id',
    async (request, reply) => {
      const userId = request.user!.userId;
      const row = db
        .prepare('SELECT id FROM levels WHERE id = ? AND user_id = ?')
        .get(request.params.id, userId);

      if (!row) return reply.code(404).send({ error: 'Nivel no encontrado' });

      const { name, data } = request.body ?? {};
      const now = Math.floor(Date.now() / 1000);

      if (name && data) {
        db.prepare(
          'UPDATE levels SET name = ?, data = ?, updated_at = ? WHERE id = ?'
        ).run(name, JSON.stringify(data), now, request.params.id);
      } else if (name) {
        db.prepare('UPDATE levels SET name = ?, updated_at = ? WHERE id = ?').run(
          name,
          now,
          request.params.id
        );
      } else if (data) {
        db.prepare('UPDATE levels SET data = ?, updated_at = ? WHERE id = ?').run(
          JSON.stringify(data),
          now,
          request.params.id
        );
      }

      return { ok: true };
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/levels/:id',
    async (request, reply) => {
      const userId = request.user!.userId;
      const result = db
        .prepare('DELETE FROM levels WHERE id = ? AND user_id = ? AND is_demo = 0')
        .run(request.params.id, userId);

      if (result.changes === 0) {
        return reply.code(404).send({ error: 'Nivel no encontrado' });
      }
      return { ok: true };
    }
  );
}

export function seedDemoLevel(): void {
  const existing = db.prepare('SELECT id FROM levels WHERE is_demo = 1 LIMIT 1').get();
  if (existing) return;

  const systemUser = db.prepare('SELECT id FROM users WHERE id = ?').get('system');
  if (!systemUser) {
    db.prepare(
      'INSERT OR IGNORE INTO users (id, nickname, password_hash) VALUES (?, ?, ?)'
    ).run('system', '__system__', 'none');
  }

  const demoData = {
    version: 1,
    name: 'Nivel Demo',
    width: 3200,
    height: 960,
    spawn: { x: 128, y: 880 },
    backgroundColor: '#5c94fc',
    platforms: [
      { id: 'p1', x: 0, y: 896, w: 3200, h: 64, solid: true },
      { id: 'p2', x: 256, y: 768, w: 256, h: 32, solid: true },
      { id: 'p3', x: 576, y: 640, w: 192, h: 32, solid: true },
      { id: 'p4', x: 832, y: 512, w: 256, h: 32, solid: true },
      { id: 'p5', x: 1152, y: 640, w: 192, h: 32, solid: true },
      { id: 'p6', x: 1408, y: 768, w: 384, h: 32, solid: true },
      { id: 'p7', x: 1856, y: 576, w: 256, h: 32, solid: true },
      { id: 'p8', x: 2176, y: 704, w: 192, h: 32, solid: true },
      { id: 'p9', x: 2432, y: 832, w: 512, h: 32, solid: true },
    ],
    enemies: [
      { id: 'e1', x: 672, y: 624, behavior: 'patrol', patrolRange: 128 },
      { id: 'e2', x: 1600, y: 752, behavior: 'patrol', patrolRange: 192 },
      { id: 'e3', x: 2688, y: 816, behavior: 'chase', patrolRange: 256 },
    ],
    portal: { x: 2880, y: 808, w: 32, h: 48 },
    skills: [
      'skill_jump',
      'skill_double_jump',
      'skill_move_left',
      'skill_move_right',
      'skill_move_left_a',
      'skill_move_right_d',
    ],
  };

  db.prepare(
    'INSERT INTO levels (id, user_id, name, data, is_demo) VALUES (?, ?, ?, ?, 1)'
  ).run('demo-level-1', 'system', 'Nivel Demo', JSON.stringify(demoData));
}

const DEMO_SKILLS = [
  'skill_jump',
  'skill_double_jump',
  'skill_move_left',
  'skill_move_right',
  'skill_move_left_a',
  'skill_move_right_d',
];

export function migrateDemoLevelSkills(): void {
  const row = db
    .prepare('SELECT id, data FROM levels WHERE id = ? AND is_demo = 1')
    .get('demo-level-1') as { id: string; data: string } | undefined;

  if (!row) return;

  const data = JSON.parse(row.data) as { skills?: string[] };
  const current = data.skills ?? [];
  const missing = DEMO_SKILLS.some((s) => !current.includes(s));
  if (!missing) return;

  data.skills = DEMO_SKILLS;
  db.prepare('UPDATE levels SET data = ? WHERE id = ?').run(
    JSON.stringify(data),
    row.id
  );
}
