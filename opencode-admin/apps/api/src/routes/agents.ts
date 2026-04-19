import type { FastifyPluginAsync } from 'fastify';
import { AGENT_IDS, type AgentRouteConfig } from '../types/index.js';
import * as files from '../services/files.js';

export const agentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ success: true, data: await files.listAgents() }));

  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const agent = await files.getAgent(request.params.id);
    if (!agent) return reply.status(404).send({ success: false, error: 'Agent not found' });
    return { success: true, data: agent };
  });

  fastify.post<{ Body: { id: string } & AgentRouteConfig }>('/', async (request, reply) => {
    try {
      const created = await files.createAgent(request.body);
      return { success: true, data: created };
    } catch (error) {
      return reply.status(400).send({ success: false, error: error instanceof Error ? error.message : 'Failed to create agent' });
    }
  });

  const updateHandler = async (id: string, body: Partial<AgentRouteConfig>, reply: { status: (code: number) => { send: (payload: unknown) => unknown } }) => {
    try {
      const updated = await files.updateAgent(id, body);
      return { success: true, data: updated };
    } catch (error) {
      return reply.status(404).send({ success: false, error: error instanceof Error ? error.message : 'Agent not found' });
    }
  };

  fastify.put<{ Params: { id: string }; Body: Partial<AgentRouteConfig> }>('/:id', async (request, reply) =>
    updateHandler(request.params.id, request.body, reply)
  );

  fastify.patch<{ Params: { id: string }; Body: Partial<AgentRouteConfig> }>('/:id', async (request, reply) =>
    updateHandler(request.params.id, request.body, reply)
  );

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    if (AGENT_IDS.includes(request.params.id as typeof AGENT_IDS[number])) {
      return reply.status(400).send({ success: false, error: 'Built-in agents cannot be deleted' });
    }
    const deleted = await files.deleteAgent(request.params.id);
    if (!deleted) return reply.status(404).send({ success: false, error: 'Agent not found' });
    return { success: true, data: { id: request.params.id } };
  });
};
