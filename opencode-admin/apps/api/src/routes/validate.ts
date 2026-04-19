import type { FastifyPluginAsync } from 'fastify';
import { buildValidation } from './shared-state.js';

export const validateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', async () => ({ success: true, data: await buildValidation() }));
  fastify.get('/', async () => ({ success: true, data: await buildValidation() }));
};
