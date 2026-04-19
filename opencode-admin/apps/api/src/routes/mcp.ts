import type { FastifyPluginAsync } from 'fastify';
import * as files from '../services/files.js';
import type { McpServerEntry } from '../types/index.js';

export const mcpRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ success: true, data: await files.listMcpServers() }));

  fastify.post<{ Body: McpServerEntry }>('/', async (request, reply) => {
    try {
      const created = await files.createMcpServer(request.body);
      return { success: true, data: created };
    } catch (error) {
      return reply.status(400).send({ success: false, error: error instanceof Error ? error.message : 'Failed to create MCP server' });
    }
  });

  const update = async (id: string, patch: Partial<McpServerEntry>, reply: { status: (code: number) => { send: (payload: unknown) => unknown } }) => {
    const updated = await files.updateMcpServer(id, patch);
    if (!updated) return reply.status(404).send({ success: false, error: 'MCP server not found' });
    return { success: true, data: updated };
  };

  fastify.patch<{ Params: { id: string }; Body: Partial<McpServerEntry> }>('/:id', async (request, reply) =>
    update(request.params.id, request.body, reply)
  );

  fastify.post<{ Params: { id: string }; Body: { enabled: boolean } }>('/:id/toggle', async (request, reply) =>
    update(request.params.id, { enabled: request.body.enabled }, reply)
  );

  fastify.post<{ Params: { id: string } }>('/:id/test', async (request, reply) => {
    const server = (await files.listMcpServers()).find((entry) => entry.id === request.params.id);
    if (!server) return reply.status(404).send({ success: false, error: 'MCP server not found' });
    return {
      success: true,
      data: {
        id: server.id,
        ok: server.enabled,
        message: server.enabled ? 'Configuration looks runnable' : 'Server is disabled',
      },
    };
  });

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const deleted = await files.deleteMcpServer(request.params.id);
    if (!deleted) return reply.status(404).send({ success: false, error: 'MCP server not found' });
    return { success: true, data: { id: request.params.id } };
  });
};
