import type { FastifyPluginAsync } from 'fastify';
import * as files from '../services/files.js';
import type { CombinedSources } from '../types/index.js';

export const configRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ success: true, data: await files.getCombinedSources() }));

  fastify.put<{ Body: Partial<CombinedSources> }>('/', async (request) => {
    await files.saveCombinedSources(request.body);
    return { success: true, data: await files.getCombinedSources() };
  });
};
