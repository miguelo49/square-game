import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { authRoutes } from './auth/routes.js';
import { attachUser } from './auth/middleware.js';
import { levelRoutes, seedDemoLevel, migrateDemoLevelSkills } from './routes/levels.js';
import { assetRoutes, seedDefaultSkills, migrateSkillKeyCodes } from './routes/assets.js';
import { skillRoutes } from './routes/skills.js';

async function main() {
  seedDefaultSkills();
  migrateSkillKeyCodes();
  seedDemoLevel();
  migrateDemoLevelSkills();

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  });

  await app.register(cookie);
  app.addHook('preHandler', attachUser);

  await app.register(authRoutes);
  await app.register(levelRoutes);
  await app.register(assetRoutes);
  await app.register(skillRoutes);

  app.get('/api/health', async () => ({ ok: true }));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Square Game API on http://localhost:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
