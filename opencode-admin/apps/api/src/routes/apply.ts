import type { FastifyPluginAsync } from 'fastify';
import { buildApplyStatus, buildDiffResult, buildValidation, runApply } from './shared-state.js';

export const applyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/status', async () => ({ success: true, data: await buildApplyStatus() }));
  fastify.get('/diff', async () => ({ success: true, data: (await buildDiffResult()).text }));
  fastify.get('/validate', async () => ({ success: true, data: await buildValidation() }));

  fastify.post('/', async (request, reply) => {
    try {
      const result = await runApply();
      return {
        success: true,
        data: {
          releaseId: result.release.id,
          timestamp: result.release.timestamp,
          filesWritten: result.filesWritten,
          validation: result.validation,
          appliedChanges: result.filesWritten.map((file) => ({
            id: file,
            type: 'update',
            resource: file,
            description: `Wrote ${file}`,
          })),
          warnings: [
            ...result.validation.warnings.map((warning) => `${warning.path}: ${warning.message}`),
            ...result.warnings,
          ],
          restartTriggered: result.release.restartTriggered,
        },
      };
    } catch (error) {
      const validation = typeof error === 'object' && error !== null && 'validation' in error ? (error as { validation: unknown }).validation : null;
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Apply failed',
        data: validation,
      });
    }
  });
};
