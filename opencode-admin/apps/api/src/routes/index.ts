import type { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.js';
import { agentsRoutes } from './agents.js';
import { pluginsRoutes } from './plugins.js';
import { providersRoutes } from './providers.js';
import { mcpRoutes } from './mcp.js';
import { oauthRoutes, secretsRoutes } from './oauth-secrets.js';
import { dashboardRoutes } from './dashboard.js';
import { validateRoutes } from './validate.js';
import { diffRoutes } from './diff.js';
import { applyRoutes } from './apply.js';
import { rollbackRoutes } from './rollback.js';
import { releasesRoutes } from './releases.js';
import { configRoutes } from './config.js';
import { updateRoutes } from './update.js';

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes);
  await fastify.register(async (instance) => {
    await instance.register(agentsRoutes, { prefix: '/agents' });
    await instance.register(pluginsRoutes, { prefix: '/plugins' });
    await instance.register(providersRoutes, { prefix: '/providers' });
    await instance.register(mcpRoutes, { prefix: '/mcp' });
    await instance.register(oauthRoutes, { prefix: '/oauth' });
    await instance.register(secretsRoutes, { prefix: '/secrets' });
    await instance.register(dashboardRoutes, { prefix: '/dashboard' });
    await instance.register(validateRoutes, { prefix: '/validate' });
    await instance.register(diffRoutes, { prefix: '/diff' });
    await instance.register(applyRoutes, { prefix: '/apply' });
    await instance.register(rollbackRoutes, { prefix: '/rollback' });
    await instance.register(releasesRoutes, { prefix: '/releases' });
    await instance.register(configRoutes, { prefix: '/config' });
    await instance.register(updateRoutes, { prefix: '/update' });
  }, { prefix: '/api/v1' });
};
