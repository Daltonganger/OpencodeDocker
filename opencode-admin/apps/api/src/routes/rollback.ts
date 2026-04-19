import type { FastifyPluginAsync } from 'fastify';
import * as files from '../services/files.js';

export const rollbackRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/last', async (request, reply) => {
    const metadata = await files.getReleaseMetadata();
    if (!metadata.history.length) {
      return reply.status(400).send({ success: false, error: 'No previous release available' });
    }

    const previous = metadata.history[0];
    const current = metadata.current;
    const restoredFiles = await files.restoreRelease(previous.id);
    if (!restoredFiles.length) {
      return reply.status(400).send({ success: false, error: 'Rollback snapshot did not contain any restorable files' });
    }
    metadata.current = previous;
    metadata.history = [...metadata.history.slice(1), ...(current ? [current] : [])].filter(Boolean);
    await files.saveReleaseMetadata(metadata);

    return {
      success: true,
      data: {
        fromReleaseId: current?.id ?? null,
        toReleaseId: previous.id,
        filesRestored: restoredFiles,
        timestamp: new Date().toISOString(),
      },
    };
  });
};
