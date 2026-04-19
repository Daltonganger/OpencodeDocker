import type { FastifyPluginAsync } from 'fastify';
import * as files from '../services/files.js';
import type { PluginEntry } from '../types/index.js';

export const pluginsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ success: true, data: await files.listPlugins() }));

  fastify.post<{ Body: PluginEntry }>('/', async (request, reply) => {
    try {
      const created = await files.createPlugin(request.body);
      return { success: true, data: created };
    } catch (error) {
      return reply.status(400).send({ success: false, error: error instanceof Error ? error.message : 'Failed to create plugin' });
    }
  });

  const update = async (id: string, patch: Partial<PluginEntry>, reply: { status: (code: number) => { send: (payload: unknown) => unknown } }) => {
    const updated = await files.updatePlugin(id, patch);
    if (!updated) return reply.status(404).send({ success: false, error: 'Plugin not found' });
    return { success: true, data: updated };
  };

  fastify.patch<{ Params: { id: string }; Body: Partial<PluginEntry> }>('/:id', async (request, reply) =>
    update(request.params.id, request.body, reply)
  );

  fastify.post<{ Params: { id: string }; Body: { enabled: boolean } }>('/:id/toggle', async (request, reply) =>
    update(request.params.id, { enabled: request.body.enabled }, reply)
  );

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const deleted = await files.deletePlugin(request.params.id);
    if (!deleted) return reply.status(404).send({ success: false, error: 'Plugin not found' });
    return { success: true, data: { id: request.params.id } };
  });
};
