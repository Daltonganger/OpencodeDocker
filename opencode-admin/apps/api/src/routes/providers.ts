import type { FastifyPluginAsync } from 'fastify';
import * as files from '../services/files.js';
import { syncProviderModels } from '../services/provider-sync.js';
import type { ProviderEntry } from '../types/index.js';

export const providersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ success: true, data: await files.listProviders() }));

  const update = async (id: string, patch: Partial<ProviderEntry>, reply: { status: (code: number) => { send: (payload: unknown) => unknown } }) => {
    const updated = await files.updateProvider(id, patch);
    if (!updated) return reply.status(404).send({ success: false, error: 'Provider not found' });
    return { success: true, data: updated };
  };

  fastify.patch<{ Params: { id: string }; Body: Partial<ProviderEntry> }>('/:id', async (request, reply) =>
    update(request.params.id, request.body, reply)
  );

  fastify.post<{ Params: { id: string }; Body: { enabled: boolean } }>('/:id/toggle', async (request, reply) =>
    update(request.params.id, { enabled: request.body.enabled }, reply)
  );

  fastify.post<{ Params: { id: string } }>('/:id/sync-models', async (request, reply) => {
    try {
      return { success: true, data: await syncProviderModels(request.params.id) };
    } catch (error) {
      return reply.status(400).send({ success: false, error: error instanceof Error ? error.message : 'Provider sync failed' });
    }
  });
};
