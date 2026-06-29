import jwt from 'jsonwebtoken';
import type { FastifyRequest, FastifyReply } from 'fastify';

const JWT_SECRET = process.env.JWT_SECRET ?? 'square-game-dev-secret-change-in-prod';
const COOKIE_NAME = 'sq_session';

export interface JwtPayload {
  userId: string;
  nickname: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function getCookieName(): string {
  return COOKIE_NAME;
}

export function getUserFromRequest(request: FastifyRequest): JwtPayload | null {
  const token = request.cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = getUserFromRequest(request);
  if (!user) {
    reply.code(401).send({ error: 'No autenticado' });
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export async function attachUser(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const user = getUserFromRequest(request);
  if (user) request.user = user;
}

export { JWT_SECRET, COOKIE_NAME };
