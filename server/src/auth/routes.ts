import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import {
  signToken,
  getCookieName,
  getUserFromRequest,
  requireAuth,
} from './middleware.js';

const NICKNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { nickname?: string; password?: string } }>(
    '/api/auth/register',
    async (request, reply) => {
      const { nickname, password } = request.body ?? {};

      if (!nickname || !password) {
        return reply.code(400).send({ error: 'Nickname y contraseña requeridos' });
      }
      if (!NICKNAME_RE.test(nickname)) {
        return reply.code(400).send({
          error: 'Nickname: 3-16 caracteres, alfanumérico y guión bajo',
        });
      }
      if (password.length < 6) {
        return reply.code(400).send({ error: 'Contraseña mínimo 6 caracteres' });
      }

      const existing = db
        .prepare('SELECT id FROM users WHERE nickname = ? COLLATE NOCASE')
        .get(nickname);
      if (existing) {
        return reply.code(409).send({ error: 'Nickname ya en uso' });
      }

      const id = uuidv4();
      const passwordHash = await bcrypt.hash(password, 12);
      db.prepare(
        'INSERT INTO users (id, nickname, password_hash) VALUES (?, ?, ?)'
      ).run(id, nickname, passwordHash);

      const token = signToken({ userId: id, nickname });
      reply.setCookie(getCookieName(), token, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });

      return { id, nickname };
    }
  );

  app.post<{ Body: { nickname?: string; password?: string } }>(
    '/api/auth/login',
    async (request, reply) => {
      const { nickname, password } = request.body ?? {};

      if (!nickname || !password) {
        return reply.code(400).send({ error: 'Nickname y contraseña requeridos' });
      }

      const user = db
        .prepare('SELECT id, nickname, password_hash FROM users WHERE nickname = ? COLLATE NOCASE')
        .get(nickname) as { id: string; nickname: string; password_hash: string } | undefined;

      if (!user) {
        return reply.code(401).send({ error: 'Credenciales inválidas' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return reply.code(401).send({ error: 'Credenciales inválidas' });
      }

      const token = signToken({ userId: user.id, nickname: user.nickname });
      reply.setCookie(getCookieName(), token, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });

      return { id: user.id, nickname: user.nickname };
    }
  );

  app.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie(getCookieName(), { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (request, reply) => {
    const user = getUserFromRequest(request);
    if (!user) {
      return reply.code(401).send({ error: 'No autenticado' });
    }
    return { id: user.userId, nickname: user.nickname };
  });
}

export { requireAuth };
