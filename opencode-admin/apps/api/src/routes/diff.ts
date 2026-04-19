import type { FastifyPluginAsync } from 'fastify';
import { buildDiffResult } from './shared-state.js';

export const diffRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ success: true, data: await buildDiffResult() }));
};
