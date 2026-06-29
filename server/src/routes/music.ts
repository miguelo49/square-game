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
        `SELECT id, name, data, is_public, created_at FROM music_tracks
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

  app.get('/api/music/public', async () => {
    const rows = db
      .prepare(
        `SELECT m.id, m.name, m.data, m.created_at, u.nickname AS author_nickname
         FROM music_tracks m
         JOIN users u ON u.id = m.user_id
         WHERE m.is_public = 1
         ORDER BY m.created_at DESC
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

  app.get<{ Params: { id: string } }>('/api/music/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const row = db
      .prepare(
        `SELECT id, name, data, is_public FROM music_tracks
         WHERE id = ? AND (user_id = ? OR is_public = 1)`
      )
      .get(request.params.id, userId) as
      | { id: string; name: string; data: string; is_public: number }
      | undefined;

    if (!row) return reply.code(404).send({ error: 'Pista no encontrada' });

    return {
      id: row.id,
      name: row.name,
      data: JSON.parse(row.data),
      isPublic: row.is_public === 1,
    };
  });

  app.post<{ Params: { id: string } }>(
    '/api/music/:id/share',
    async (request, reply) => {
      const userId = request.user!.userId;
      const row = db
        .prepare('SELECT id, is_public FROM music_tracks WHERE id = ? AND user_id = ?')
        .get(request.params.id, userId) as
        | { id: string; is_public: number }
        | undefined;

      if (!row) return reply.code(404).send({ error: 'Pista no encontrada' });

      const nextPublic = row.is_public === 1 ? 0 : 1;
      const now = Math.floor(Date.now() / 1000);
      db.prepare('UPDATE music_tracks SET is_public = ?, updated_at = ? WHERE id = ?').run(
        nextPublic,
        now,
        request.params.id
      );
      return { isPublic: nextPublic === 1 };
    }
  );

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
      const now = Math.floor(Date.now() / 1000);
      if (name && data) {
        db.prepare(
          'UPDATE music_tracks SET name = ?, data = ?, updated_at = ? WHERE id = ?'
        ).run(name, JSON.stringify(data), now, request.params.id);
      } else if (name) {
        db.prepare('UPDATE music_tracks SET name = ?, updated_at = ? WHERE id = ?').run(
          name,
          now,
          request.params.id
        );
      } else if (data) {
        db.prepare('UPDATE music_tracks SET data = ?, updated_at = ? WHERE id = ?').run(
          JSON.stringify(data),
          now,
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
