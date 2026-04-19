import type { FastifyPluginAsync } from 'fastify';
import * as files from '../services/files.js';
import { buildApplyStatus, buildDiffResult } from './shared-state.js';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  const handler = async () => {
    const [agents, plugins, providers, mcpServers, oauthEntries, secrets, releaseMetadata, applyStatus] = await Promise.all([
      files.listAgents(),
      files.listPlugins(),
      files.listProviders(),
      files.listMcpServers(),
      files.getOAuthSource(),
      files.getSecretStatuses(),
      files.getReleaseMetadata(),
      buildApplyStatus(),
    ]);

    const oauthStatusEntries = Object.values(oauthEntries.status);
    const configuredOauth = Object.entries(oauthEntries.providers).filter(([, provider]) => {
      const runtimeManagedAuth = provider.metadata?.runtimeManagedAuth === true;
      if (runtimeManagedAuth) return true;
      const secretKeys = new Set(secrets.filter((secret) => secret.configured).map((secret) => secret.key));
      return Boolean(provider.clientIdRef && provider.clientSecretRef && secretKeys.has(provider.clientIdRef) && secretKeys.has(provider.clientSecretRef));
    }).length;

    return {
      success: true,
      data: {
        currentRelease: releaseMetadata.current,
        dirty: applyStatus.dirty,
        targetStackPath: (await import('../services/config.js')).config.targetStackPath,
        lastApplied: releaseMetadata.current?.timestamp ?? null,
        stats: {
          agents: { total: agents.length, enabled: agents.filter((agent) => agent.enabled).length },
          plugins: { total: plugins.length, enabled: plugins.filter((plugin) => plugin.enabled).length },
          providers: { total: providers.length, enabled: providers.filter((provider) => provider.enabled).length },
          mcpServers: { total: mcpServers.length, enabled: mcpServers.filter((server) => server.enabled).length },
          oauth: {
            total: Object.keys(oauthEntries.providers).length,
            configured: configuredOauth,
            connected: oauthStatusEntries.filter((entry) => entry.connected).length,
          },
          secrets: {
            total: secrets.length,
            configured: secrets.filter((secret) => secret.configured).length,
            missing: secrets.filter((secret) => !secret.configured).length,
          },
        },
        pendingChanges: applyStatus.pendingChanges,
      },
    };
  };

  fastify.get('/', handler);
  fastify.get('/stats', handler);
  fastify.get('/diff-preview', async () => ({ success: true, data: await buildDiffResult() }));
};
