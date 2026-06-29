import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { requireAuth } from '../auth/routes.js';

export async function skillRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/api/skills', async (request) => {
    const userId = request.user!.userId;
    const rows = db
      .prepare(
        `SELECT id, name, data, is_public, created_at FROM skills
         WHERE user_id = ? OR user_id = 'system'
         ORDER BY created_at ASC`
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

  app.get('/api/skills/public', async () => {
    const rows = db
      .prepare(
        `SELECT s.id, s.name, s.data, s.created_at, u.nickname AS author_nickname
         FROM skills s
         JOIN users u ON u.id = s.user_id
         WHERE s.is_public = 1 AND s.user_id != 'system'
         ORDER BY s.created_at DESC
         LIMIT 100`
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

  app.get<{ Params: { id: string } }>('/api/skills/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const row = db
      .prepare(
        `SELECT id, name, data, is_public FROM skills
         WHERE id = ? AND (user_id = ? OR user_id = 'system' OR is_public = 1)`
      )
      .get(request.params.id, userId) as
      | { id: string; name: string; data: string; is_public: number }
      | undefined;

    if (!row) return reply.code(404).send({ error: 'Skill no encontrada' });

    return {
      id: row.id,
      name: row.name,
      data: JSON.parse(row.data),
      isPublic: row.is_public === 1,
    };
  });

  app.post<{ Params: { id: string } }>(
    '/api/skills/:id/share',
    async (request, reply) => {
      const userId = request.user!.userId;
      const row = db
        .prepare('SELECT id, is_public FROM skills WHERE id = ? AND user_id = ?')
        .get(request.params.id, userId) as
        | { id: string; is_public: number }
        | undefined;

      if (!row) return reply.code(404).send({ error: 'Skill no encontrada' });

      const nextPublic = row.is_public === 1 ? 0 : 1;
      db.prepare('UPDATE skills SET is_public = ? WHERE id = ?').run(
        nextPublic,
        request.params.id
      );
      return { isPublic: nextPublic === 1 };
    }
  );

  app.post<{ Body: { name?: string; data?: unknown } }>(
    '/api/skills',
    async (request, reply) => {
      const userId = request.user!.userId;
      const { name, data } = request.body ?? {};

      if (!name || !data) {
        return reply.code(400).send({ error: 'name y data requeridos' });
      }

      const id = uuidv4();
      db.prepare('INSERT INTO skills (id, user_id, name, data) VALUES (?, ?, ?, ?)').run(
        id,
        userId,
        name,
        JSON.stringify(data)
      );

      return { id, name, data };
    }
  );

  app.put<{ Params: { id: string }; Body: { name?: string; data?: unknown } }>(
    '/api/skills/:id',
    async (request, reply) => {
      const userId = request.user!.userId;
      const row = db
        .prepare('SELECT id FROM skills WHERE id = ? AND user_id = ?')
        .get(request.params.id, userId);

      if (!row) return reply.code(404).send({ error: 'Skill no encontrada' });

      const { name, data } = request.body ?? {};
      if (name && data) {
        db.prepare('UPDATE skills SET name = ?, data = ? WHERE id = ?').run(
          name,
          JSON.stringify(data),
          request.params.id
        );
      } else if (data) {
        db.prepare('UPDATE skills SET data = ? WHERE id = ?').run(
          JSON.stringify(data),
          request.params.id
        );
      }

      return { ok: true };
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/skills/:id',
    async (request, reply) => {
      const userId = request.user!.userId;
      const result = db
        .prepare('DELETE FROM skills WHERE id = ? AND user_id = ?')
        .run(request.params.id, userId);

      if (result.changes === 0) {
        return reply.code(404).send({ error: 'Skill no encontrada' });
      }
      return { ok: true };
    }
  );
}
