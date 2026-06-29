import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { requireAuth } from '../auth/routes.js';

const MAX_TRACKS = 32;

export async function musicRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/api/music', async (request) => {
    const userId = request.user!.userId;
    const rows = db
      .prepare(
        'SELECT id, name, data, created_at FROM music_tracks WHERE user_id = ? ORDER BY created_at DESC'
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
    '/api/music',
    async (request, reply) => {
      const userId = request.user!.userId;
      const { name, data } = request.body ?? {};
      if (!name || !data) {
        return reply.code(400).send({ error: 'name y data requeridos' });
      }

      const count = db
        .prepare('SELECT COUNT(*) as c FROM music_tracks WHERE user_id = ?')
        .get(userId) as { c: number };
      if (count.c >= MAX_TRACKS) {
        return reply.code(400).send({ error: `Máximo ${MAX_TRACKS} pistas por usuario` });
      }

      const id = uuidv4();
      db.prepare('INSERT INTO music_tracks (id, user_id, name, data) VALUES (?, ?, ?, ?)').run(
        id,
        userId,
        name,
        JSON.stringify(data)
      );
      return { id, name, data };
    }
  );

  app.put<{ Params: { id: string }; Body: { name?: string; data?: unknown } }>(
    '/api/music/:id',
    async (request, reply) => {
      const userId = request.user!.userId;
      const row = db
        .prepare('SELECT id FROM music_tracks WHERE id = ? AND user_id = ?')
        .get(request.params.id, userId);
      if (!row) return reply.code(404).send({ error: 'Pista no encontrada' });

      const { name, data } = request.body ?? {};
      if (name && data) {
        db.prepare('UPDATE music_tracks SET name = ?, data = ? WHERE id = ?').run(
          name,
          JSON.stringify(data),
          request.params.id
        );
      } else if (name) {
        db.prepare('UPDATE music_tracks SET name = ? WHERE id = ?').run(name, request.params.id);
      } else if (data) {
        db.prepare('UPDATE music_tracks SET data = ? WHERE id = ?').run(
          JSON.stringify(data),
          request.params.id
        );
      }
      return { ok: true };
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/music/:id',
    async (request, reply) => {
      const userId = request.user!.userId;
      const result = db
        .prepare('DELETE FROM music_tracks WHERE id = ? AND user_id = ?')
        .run(request.params.id, userId);
      if (result.changes === 0) {
        return reply.code(404).send({ error: 'Pista no encontrada' });
      }
      return { ok: true };
    }
  );
}
