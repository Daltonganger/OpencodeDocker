import type { FastifyPluginAsync } from 'fastify';
import { getOpencodeUpdateStatus, triggerOpencodeUpdate } from '../services/opencode-update.js';

export const updateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/status', async () => ({ success: true, data: await getOpencodeUpdateStatus() }));

  fastify.post('/opencode', async (request, reply) => {
    try {
      const status = await triggerOpencodeUpdate();
      return reply.status(202).send({ success: true, data: status });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'OpenCode update failed to start',
      });
    }
  });
};
