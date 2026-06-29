import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { requireAuth } from '../auth/routes.js';

const MAX_ASSETS = 64;

export async function assetRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/api/assets', async (request) => {
    const userId = request.user!.userId;
    const rows = db
      .prepare(
        `SELECT id, name, data, is_public, created_at FROM assets
         WHERE user_id = ? ORDER BY created_at DESC`
      )
      .all(userId) as Array<{
      id: string;
      name: string;
      data: string;
      is_public: number;
      created_at: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      data: JSON.parse(r.data),
      isPublic: r.is_public === 1,
      createdAt: r.created_at,
    }));
  });

  app.get('/api/assets/public', async () => {
    const rows = db
      .prepare(
        `SELECT a.id, a.name, a.data, a.created_at, u.nickname AS author_nickname
         FROM assets a
         JOIN users u ON u.id = a.user_id
         WHERE a.is_public = 1
         ORDER BY a.created_at DESC
         LIMIT 200`
      )
      .all() as Array<{
      id: string;
      name: string;
      data: string;
      created_at: number;
      author_nickname: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      data: JSON.parse(r.data),
      authorNickname: r.author_nickname,
      createdAt: r.created_at,
    }));
  });

  app.get<{ Params: { id: string } }>('/api/assets/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const row = db
      .prepare(
        `SELECT id, name, data, is_public, user_id FROM assets
         WHERE id = ? AND (user_id = ? OR is_public = 1)`
      )
      .get(request.params.id, userId) as
      | { id: string; name: string; data: string; is_public: number; user_id: string }
      | undefined;

    if (!row) return reply.code(404).send({ error: 'Asset no encontrado' });

    return {
      id: row.id,
      name: row.name,
      data: JSON.parse(row.data),
      isPublic: row.is_public === 1,
    };
  });

  app.post<{ Params: { id: string } }>(
    '/api/assets/:id/share',
    async (request, reply) => {
      const userId = request.user!.userId;
      const row = db
        .prepare('SELECT id, is_public FROM assets WHERE id = ? AND user_id = ?')
        .get(request.params.id, userId) as
        | { id: string; is_public: number }
        | undefined;

      if (!row) return reply.code(404).send({ error: 'Asset no encontrado' });

      const nextPublic = row.is_public === 1 ? 0 : 1;
      db.prepare('UPDATE assets SET is_public = ? WHERE id = ?').run(
        nextPublic,
        request.params.id
      );
      return { isPublic: nextPublic === 1 };
    }
  );

  app.post<{ Body: { name?: string; data?: unknown } }>(
    '/api/assets',
    async (request, reply) => {
      const userId = request.user!.userId;
      const { name, data } = request.body ?? {};

      if (!name || !data) {
        return reply.code(400).send({ error: 'name y data requeridos' });
      }

      const count = db
        .prepare('SELECT COUNT(*) as c FROM assets WHERE user_id = ?')
        .get(userId) as { c: number };
      if (count.c >= MAX_ASSETS) {
        return reply.code(400).send({ error: `Máximo ${MAX_ASSETS} assets por usuario` });
      }

      const id = uuidv4();
      const payload =
        data && typeof data === 'object'
          ? { ...(data as Record<string, unknown>), id }
          : data;
      db.prepare('INSERT INTO assets (id, user_id, name, data) VALUES (?, ?, ?, ?)').run(
        id,
        userId,
        name,
        JSON.stringify(payload)
      );

      return { id, name, data: payload };
    }
  );

  app.put<{ Params: { id: string }; Body: { name?: string; data?: unknown } }>(
    '/api/assets/:id',
    async (request, reply) => {
      const userId = request.user!.userId;
      const row = db
        .prepare('SELECT id FROM assets WHERE id = ? AND user_id = ?')
        .get(request.params.id, userId);

      if (!row) return reply.code(404).send({ error: 'Asset no encontrado' });

      const { name, data } = request.body ?? {};
      if (name && data) {
        const payload =
          typeof data === 'object'
            ? { ...(data as Record<string, unknown>), id: request.params.id }
            : data;
        db.prepare('UPDATE assets SET name = ?, data = ? WHERE id = ?').run(
          name,
          JSON.stringify(payload),
          request.params.id
        );
      } else if (name) {
        db.prepare('UPDATE assets SET name = ? WHERE id = ?').run(name, request.params.id);
      } else if (data) {
        const payload =
          typeof data === 'object'
            ? { ...(data as Record<string, unknown>), id: request.params.id }
            : data;
        db.prepare('UPDATE assets SET data = ? WHERE id = ?').run(
          JSON.stringify(payload),
          request.params.id
        );
      }

      return { ok: true };
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/assets/:id',
    async (request, reply) => {
      const userId = request.user!.userId;
      const result = db
        .prepare('DELETE FROM assets WHERE id = ? AND user_id = ?')
        .run(request.params.id, userId);

      if (result.changes === 0) {
        return reply.code(404).send({ error: 'Asset no encontrado' });
      }
      return { ok: true };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/assets/:id/clone',
    async (request, reply) => {
      const userId = request.user!.userId;
      const row = db
        .prepare(
          `SELECT name, data FROM assets WHERE id = ? AND (user_id = ? OR is_public = 1)`
        )
        .get(request.params.id, userId) as { name: string; data: string } | undefined;

      if (!row) return reply.code(404).send({ error: 'Asset no encontrado' });

      const count = db
        .prepare('SELECT COUNT(*) as c FROM assets WHERE user_id = ?')
        .get(userId) as { c: number };
      if (count.c >= MAX_ASSETS) {
        return reply.code(400).send({ error: `Máximo ${MAX_ASSETS} assets por usuario` });
      }

      const id = uuidv4();
      const data = JSON.parse(row.data) as Record<string, unknown>;
      data.id = id;
      const cloneName = `${row.name} (copia)`;
      db.prepare('INSERT INTO assets (id, user_id, name, data) VALUES (?, ?, ?, ?)').run(
        id,
        userId,
        cloneName,
        JSON.stringify(data)
      );
      return { id, name: cloneName, data };
    }
  );
}

export function seedDefaultSkills(): void {
  const systemUser = db.prepare('SELECT id FROM users WHERE id = ?').get('system');
  if (!systemUser) {
    db.prepare(
      'INSERT OR IGNORE INTO users (id, nickname, password_hash) VALUES (?, ?, ?)'
    ).run('system', '__system__', 'none');
  }

  const defaults = [
    {
      id: 'skill_jump',
      name: 'Saltar',
      data: {
        id: 'skill_jump',
        name: 'Saltar',
        trigger: { type: 'keydown', key: 'SPACE' },
        actions: [{ type: 'jump', force: 420 }],
        conditions: [{ type: 'onGround' }],
      },
    },
    {
      id: 'skill_move_left',
      name: 'Correr Izquierda',
      data: {
        id: 'skill_move_left',
        name: 'Correr Izquierda',
        trigger: { type: 'hold', key: 'LEFT' },
        actions: [{ type: 'move', axis: 'x', speed: -220 }],
      },
    },
    {
      id: 'skill_move_right',
      name: 'Correr Derecha',
      data: {
        id: 'skill_move_right',
        name: 'Correr Derecha',
        trigger: { type: 'hold', key: 'RIGHT' },
        actions: [{ type: 'move', axis: 'x', speed: 220 }],
      },
    },
    {
      id: 'skill_move_left_a',
      name: 'Correr Izq (A)',
      data: {
        id: 'skill_move_left_a',
        name: 'Correr Izq (A)',
        trigger: { type: 'hold', key: 'A' },
        actions: [{ type: 'move', axis: 'x', speed: -220 }],
      },
    },
    {
      id: 'skill_move_right_d',
      name: 'Correr Der (D)',
      data: {
        id: 'skill_move_right_d',
        name: 'Correr Der (D)',
        trigger: { type: 'hold', key: 'D' },
        actions: [{ type: 'move', axis: 'x', speed: 220 }],
      },
    },
    {
      id: 'skill_dash',
      name: 'Dash',
      data: {
        id: 'skill_dash',
        name: 'Dash',
        trigger: { type: 'keydown', key: 'SHIFT' },
        actions: [{ type: 'dash', distance: 160, cooldown: 800 }],
        conditions: [{ type: 'onGround' }],
      },
    },
    {
      id: 'skill_double_jump',
      name: 'Doble salto',
      data: {
        id: 'skill_double_jump',
        name: 'Doble salto',
        trigger: { type: 'keydown', key: 'SPACE' },
        actions: [{ type: 'impulse', axis: 'y', force: 320, animClip: 'jump' }],
        conditions: [{ type: 'airJumpAvailable' }],
        animClip: 'jump',
      },
    },
  ];

  for (const skill of defaults) {
    const existing = db.prepare('SELECT id FROM skills WHERE id = ?').get(skill.id);
    if (!existing) {
      db.prepare(
        'INSERT INTO skills (id, user_id, name, data) VALUES (?, ?, ?, ?)'
      ).run(skill.id, 'system', skill.name, JSON.stringify(skill.data));
    } else {
      db.prepare('UPDATE skills SET name = ?, data = ? WHERE id = ? AND user_id = ?').run(
        skill.name,
        JSON.stringify(skill.data),
        skill.id,
        'system'
      );
    }
  }
}

const DOM_TO_PHASER: Record<string, string> = {
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  KeyA: 'A',
  KeyD: 'D',
  KeyW: 'W',
  KeyS: 'S',
  KeyZ: 'Z',
  KeyX: 'X',
  Space: 'SPACE',
  ShiftLeft: 'SHIFT',
  ShiftRight: 'SHIFT',
};

export function migrateSkillKeyCodes(): void {
  const rows = db.prepare('SELECT id, data FROM skills').all() as Array<{
    id: string;
    data: string;
  }>;

  for (const row of rows) {
    const data = JSON.parse(row.data) as { trigger?: { key?: string } };
    const key = data.trigger?.key;
    if (!key) continue;
    const next = DOM_TO_PHASER[key];
    if (!next) continue;
    data.trigger!.key = next;
    db.prepare('UPDATE skills SET data = ? WHERE id = ?').run(JSON.stringify(data), row.id);
  }
}
