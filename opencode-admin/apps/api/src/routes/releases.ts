import type { FastifyPluginAsync } from 'fastify';
import * as files from '../services/files.js';

export const releasesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ success: true, data: await files.getReleaseMetadata() }));
};
