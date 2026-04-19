import type { CombinedSources, ValidationIssue, ValidationResult } from '../types/index.js';
import { AGENT_IDS } from '../types/index.js';

function pushUnique(issueList: ValidationIssue[], issue: ValidationIssue): void {
  if (!issueList.find((item) => item.path === issue.path && item.message === issue.message)) {
    issueList.push(issue);
  }
}

export function validateSources(sources: CombinedSources, envEntries: Record<string, string> = {}): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  for (const agentId of AGENT_IDS) {
    const agent = sources.routing.agents[agentId];
    if (!agent) {
      pushUnique(errors, { path: `routing.agents.${agentId}`, message: 'Required agent is missing' });
      continue;
    }
    if (!agent.primary?.provider || !agent.primary?.model) {
      pushUnique(errors, { path: `routing.agents.${agentId}.primary`, message: 'Primary provider/model is required' });
    }
    if (!agent.fallback?.provider || !agent.fallback?.model) {
      pushUnique(warnings, { path: `routing.agents.${agentId}.fallback`, message: 'Fallback provider/model is recommended' });
    }
  }

  const enabledProviderIds = new Set(
    sources.providers.providers
      .filter((provider) => provider.enabled && (!provider.secretRef || Boolean(envEntries[provider.secretRef])))
      .flatMap((provider) => [provider.id, provider.alias].filter(Boolean))
  );

  for (const [agentId, agent] of Object.entries(sources.routing.agents)) {
    if (!enabledProviderIds.has(agent.primary.provider)) {
      pushUnique(errors, { path: `routing.agents.${agentId}.primary.provider`, message: `Unknown provider '${agent.primary.provider}'` });
    }
    if (!enabledProviderIds.has(agent.fallback.provider)) {
      pushUnique(warnings, { path: `routing.agents.${agentId}.fallback.provider`, message: `Unknown fallback provider '${agent.fallback.provider}'` });
    }
  }

  if (!Object.values(sources.routing.agents).some((agent) => agent.enabled)) {
    pushUnique(errors, { path: 'routing.agents', message: 'At least one agent must remain enabled' });
  }

  const pluginIds = new Set<string>();
  for (const plugin of sources.plugins.plugins) {
    if (!plugin.id) pushUnique(errors, { path: 'plugins[].id', message: 'Plugin id is required' });
    if (pluginIds.has(plugin.id)) pushUnique(errors, { path: `plugins.${plugin.id}`, message: 'Plugin ids must be unique' });
    pluginIds.add(plugin.id);
  }

  const providerIdSet = new Set<string>();
  for (const provider of sources.providers.providers) {
    if (!provider.id) pushUnique(errors, { path: 'providers[].id', message: 'Provider id is required' });
    if (!provider.secretRef && provider.id !== 'google' && provider.id !== 'qwen-code') {
      pushUnique(warnings, { path: `providers.${provider.id}.secretRef`, message: 'Secret ref is recommended' });
    }
    if (providerIdSet.has(provider.id)) pushUnique(errors, { path: `providers.${provider.id}`, message: 'Provider ids must be unique' });
    providerIdSet.add(provider.id);
    if (provider.enabled && provider.secretRef && !envEntries[provider.secretRef]) {
      pushUnique(warnings, { path: `providers.${provider.id}.secretRef`, message: `Missing env secret '${provider.secretRef}' — provider will stay disabled until the secret is set` });
    }
  }

  const mcpIds = new Set<string>();
  for (const server of sources.mcp.servers) {
    if (!server.id) pushUnique(errors, { path: 'mcp.servers[].id', message: 'MCP server id is required' });
    if (mcpIds.has(server.id)) pushUnique(errors, { path: `mcp.servers.${server.id}`, message: 'MCP server ids must be unique' });
    mcpIds.add(server.id);
    if (server.enabled) {
      for (const envRef of server.envRefs) {
        if (!envEntries[envRef]) {
          pushUnique(errors, { path: `mcp.servers.${server.id}.envRefs`, message: `Missing env secret '${envRef}' for enabled MCP server` });
        }
      }
    }
  }

  for (const [agentId, agent] of Object.entries(sources.routing.agents)) {
    for (const mcpId of agent.mcpAllowlist) {
      if (!mcpIds.has(mcpId)) {
        pushUnique(warnings, { path: `routing.agents.${agentId}.mcpAllowlist`, message: `Unknown MCP id '${mcpId}'` });
      }
    }
  }

  for (const [providerId, oauthProvider] of Object.entries(sources.oauth.providers)) {
    if (!oauthProvider.enabled) continue;
    const runtimeManagedAuth = oauthProvider.metadata?.runtimeManagedAuth === true;
    if (runtimeManagedAuth) continue;
    if (oauthProvider.clientIdRef && !envEntries[oauthProvider.clientIdRef]) {
      pushUnique(warnings, { path: `oauth.providers.${providerId}.clientIdRef`, message: `Missing OAuth client id '${oauthProvider.clientIdRef}'` });
    }
    if (oauthProvider.clientSecretRef && !envEntries[oauthProvider.clientSecretRef]) {
      pushUnique(warnings, { path: `oauth.providers.${providerId}.clientSecretRef`, message: `Missing OAuth client secret '${oauthProvider.clientSecretRef}'` });
    }
  }

  const secretKeys = new Set(sources.secretsRefs.secrets.map((secret) => secret.key));
  for (const provider of Object.values(sources.oauth.providers)) {
    const runtimeManagedAuth = provider.metadata?.runtimeManagedAuth === true;
    if (runtimeManagedAuth) continue;
    if (provider.clientIdRef && !secretKeys.has(provider.clientIdRef)) {
      pushUnique(warnings, { path: `oauth.providers.${provider.displayName}.clientIdRef`, message: `Unknown secret ref '${provider.clientIdRef}'` });
    }
    if (provider.clientSecretRef && !secretKeys.has(provider.clientSecretRef)) {
      pushUnique(warnings, { path: `oauth.providers.${provider.displayName}.clientSecretRef`, message: `Unknown secret ref '${provider.clientSecretRef}'` });
    }
  }

  // Council validation
  if (sources.routing.council) {
    const council = sources.routing.council;
    if (!council.master?.model) {
      pushUnique(errors, { path: 'routing.council.master.model', message: 'Council master model is required' });
    }
    if (!council.presets || Object.keys(council.presets).length === 0) {
      pushUnique(errors, { path: 'routing.council.presets', message: 'Council requires at least one preset' });
    }
    if (council.default_preset && council.presets && !council.presets[council.default_preset]) {
      pushUnique(warnings, { path: 'routing.council.default_preset', message: `Council default preset "${council.default_preset}" not found in presets` });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
