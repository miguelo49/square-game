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
        `SELECT id, name, data, created_at FROM skills
         WHERE user_id = ? OR user_id = 'system'
         ORDER BY created_at ASC`
      )
      .all(userId) as Array<{ id: string; name: string; data: string; created_at: number }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      data: JSON.parse(r.data),
      createdAt: r.created_at,
    }));
  });

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
