import path from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { apiRoutes } from './routes/index.js';
import { ensureBaseStructure } from './services/files.js';

const WEB_DIST = process.env.WEB_DIST_DIR || path.join(process.cwd(), 'web-dist');

const fastify = Fastify({
  logger: true,
});

// Start server
const start = async () => {
  try {
    // Register CORS
    await fastify.register(cors, {
      origin: true,
    });

    // Register API routes
    await fastify.register(apiRoutes);

    await ensureBaseStructure();

    // Serve static web assets (must be registered after API routes)
    await fastify.register(fastifyStatic, {
      root: WEB_DIST,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback: for any non-API, non-health, non-static route return index.html
    fastify.setNotFoundHandler((request, reply) => {
      const url = request.url;
      // Skip API and health paths — these are genuine 404s
      if (url.startsWith('/api/') || url === '/health') {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.type('text/html').sendFile('index.html');
    });

    const port = parseInt(process.env.API_PORT || process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    console.log(`Server listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
