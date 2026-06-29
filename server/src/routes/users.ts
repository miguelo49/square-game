import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { requireAuth } from '../auth/routes.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get<{ Params: { nickname: string } }>(
    '/api/users/:nickname',
    async (request, reply) => {
      const nickname = request.params.nickname;
      const user = db
        .prepare('SELECT id, nickname, created_at FROM users WHERE nickname = ? COLLATE NOCASE')
        .get(nickname) as { id: string; nickname: string; created_at: number } | undefined;

      if (!user || user.nickname === '__system__') {
        return reply.code(404).send({ error: 'Usuario no encontrado' });
      }

      const levels = db
        .prepare(
          `SELECT l.id, l.name, l.data, l.play_count, l.clear_count, l.tags, l.updated_at,
            (SELECT COUNT(*) FROM level_likes WHERE level_id = l.id) AS like_count
           FROM levels l
           WHERE l.user_id = ? AND l.is_public = 1 AND l.is_demo = 0
           ORDER BY l.updated_at DESC
           LIMIT 50`
        )
        .all(user.id) as Array<{
        id: string;
        name: string;
        data: string;
        play_count: number;
        clear_count: number;
        tags: string;
        updated_at: number;
        like_count: number;
      }>;

      return {
        nickname: user.nickname,
        createdAt: user.created_at,
        levels: levels.map((l) => ({
          id: l.id,
          name: l.name,
          data: JSON.parse(l.data),
          playCount: l.play_count,
          clearCount: l.clear_count,
          likeCount: l.like_count,
          clearRate: l.play_count > 0 ? Math.round((l.clear_count / l.play_count) * 100) : 0,
          tags: JSON.parse(l.tags || '[]') as string[],
          updatedAt: l.updated_at,
        })),
      };
    }
  );
}
