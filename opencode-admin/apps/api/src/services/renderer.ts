import type { CombinedSources, McpServerEntry, ProviderEntry, RenderedConfigs } from '../types/index.js';

function providerNpm(provider: ProviderEntry): string {
  if (provider.type === 'anthropic') return '@ai-sdk/anthropic';
  if (provider.type === 'google') return '@ai-sdk/google';
  if (provider.type === 'openai') return '@ai-sdk/openai';
  return '@ai-sdk/openai-compatible';
}

function providerOptions(provider: ProviderEntry): Record<string, string> {
  const options: Record<string, unknown> = {};
  if (provider.secretRef) options.apiKey = `{env:${provider.secretRef}}`;
  if (provider.type === 'google' && !options.apiKey) options.apiKey = 'oauth-managed';
  if (provider.type !== 'anthropic' && provider.type !== 'openai' && provider.baseUrl) {
    options.baseURL = provider.baseUrl;
  }
  if (provider.type === 'openai' && provider.baseUrl && provider.baseUrl !== 'https://api.openai.com/v1') {
    options.baseURL = provider.baseUrl;
  }
  if (provider.id === 'github') {
    options.headers = {
      'User-Agent': 'GitHubCopilotChat/0.26.7',
      'Editor-Version': 'vscode/1.96.2',
      'Editor-Plugin-Version': 'copilot-chat/0.26.7',
      'Openai-Organization': 'github-copilot',
      'Openai-Intent': 'conversation-panel',
      'X-GitHub-Api-Version': '2023-07-07',
    };
  }
  return options as Record<string, string>;
}

function normalizeModelLimit(limit?: { context?: number; output?: number }): { context: number; output: number } {
  const value = limit ?? {};

  return {
    context: value.context ?? 128000,
    output: value.output ?? 8192,
  };
}

function renderProviderModels(provider: ProviderEntry): Record<string, unknown> | undefined {
  if (provider.id === 'google') {
    return {
      'antigravity-gemini-3-pro': {
        name: 'Gemini 3 Pro (Antigravity)',
        limit: { context: 1048576, output: 65535 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
        variants: { low: { thinkingLevel: 'low' }, high: { thinkingLevel: 'high' } },
      },
      'antigravity-gemini-3.1-pro': {
        name: 'Gemini 3.1 Pro (Antigravity)',
        limit: { context: 1048576, output: 65535 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
        variants: { low: { thinkingLevel: 'low' }, high: { thinkingLevel: 'high' } },
      },
      'antigravity-gemini-3-flash': {
        name: 'Gemini 3 Flash (Antigravity)',
        limit: { context: 1048576, output: 65536 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
        variants: {
          minimal: { thinkingLevel: 'minimal' },
          low: { thinkingLevel: 'low' },
          medium: { thinkingLevel: 'medium' },
          high: { thinkingLevel: 'high' },
        },
      },
      'antigravity-claude-sonnet-4-6': {
        name: 'Claude Sonnet 4.6 (Antigravity)',
        limit: { context: 200000, output: 64000 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
      },
      'antigravity-claude-opus-4-6-thinking': {
        name: 'Claude Opus 4.6 Thinking (Antigravity)',
        limit: { context: 200000, output: 64000 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
        variants: { low: { thinkingConfig: { thinkingBudget: 8192 } }, max: { thinkingConfig: { thinkingBudget: 32768 } } },
      },
      'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash (Gemini CLI)',
        limit: { context: 1048576, output: 65536 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
      },
      'gemini-2.5-pro': {
        name: 'Gemini 2.5 Pro (Gemini CLI)',
        limit: { context: 1048576, output: 65536 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
      },
      'gemini-3-flash-preview': {
        name: 'Gemini 3 Flash Preview (Gemini CLI)',
        limit: { context: 1048576, output: 65536 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
      },
      'gemini-3-pro-preview': {
        name: 'Gemini 3 Pro Preview (Gemini CLI)',
        limit: { context: 1048576, output: 65535 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
      },
      'gemini-3.1-pro-preview': {
        name: 'Gemini 3.1 Pro Preview (Gemini CLI)',
        limit: { context: 1048576, output: 65535 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
      },
      'gemini-3.1-pro-preview-customtools': {
        name: 'Gemini 3.1 Pro Preview Custom Tools (Gemini CLI)',
        limit: { context: 1048576, output: 65535 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
      },
    };
  }

  if (provider.id === 'qwen-code') {
    return {
      'coder-model': {
        id: 'coder-model',
        name: 'Qwen Coder (Qwen 3.5 Plus)',
        reasoning: true,
        limit: { context: 1048576, output: 65536 },
        cost: { input: 0, output: 0 },
        modalities: { input: ['text'], output: ['text'] },
      },
      'vision-model': {
        id: 'vision-model',
        name: 'Qwen VL Plus (Vision)',
        reasoning: false,
        limit: { context: 131072, output: 8192 },
        cost: { input: 0, output: 0 },
        modalities: { input: ['text', 'image'], output: ['text'] },
      },
    };
  }

  if (!provider.models?.length) return undefined;
  return Object.fromEntries(provider.models.map((model) => [
    model.id,
    {
      id: model.id,
      name: model.name,
      limit: normalizeModelLimit(model.limit),
      ...(model.pricing && (model.pricing.input !== undefined || model.pricing.output !== undefined)
        ? {
            cost: {
              input: model.pricing.input ?? 0,
              output: model.pricing.output ?? 0,
            },
          }
        : {}),
    },
  ]));
}

function renderProviderWhitelist(provider: ProviderEntry): string[] | undefined {
  const visibleModels = provider.models.filter((model) => model.visibleInOpencode).map((model) => model.id);
  return visibleModels.length ? visibleModels : undefined;
}

function runtimeProviderKey(provider: Pick<ProviderEntry, 'id' | 'alias'>): string {
  const alias = provider.alias.trim();
  return alias || provider.id;
}

function normalizeProviderRef(providers: ProviderEntry[], providerRef: string): string {
  const trimmed = providerRef.trim();
  const matched = providers.find((provider) => provider.id === trimmed || provider.alias === trimmed);
  return matched ? runtimeProviderKey(matched) : trimmed;
}

function renderMcpServer(server: McpServerEntry): Record<string, unknown> {
  if (server.type === 'remote') {
    return {
      type: 'remote',
      url: server.url,
    };
  }

  return {
    type: 'local',
    command: [server.command ?? 'npx', ...(server.args ?? [])],
    environment: Object.fromEntries(server.envRefs.map((ref) => [ref, `{env:${ref}}`])),
  };
}

function modelRef(providers: ProviderEntry[], provider: string, model: string): string {
  return `${normalizeProviderRef(providers, provider)}/${model}`;
}

export function renderConfigs(sources: CombinedSources): RenderedConfigs {
  const enabledProviders = sources.providers.providers.filter((provider) => provider.enabled);
  const renderedProviders = enabledProviders.filter((provider) => provider.type !== 'builtin');
  const enabledAgents = Object.entries(sources.routing.agents).filter(([, agent]) => agent.enabled);
  const defaultAgent = enabledAgents.find(([id]) => id === 'orchestrator') ?? enabledAgents[0];
  const smallAgent = enabledAgents.find(([id]) => id === 'fixer') ?? enabledAgents[0];
  const enabledPlugins = [...sources.plugins.plugins]
    .filter((plugin) => plugin.enabled)
    .sort((a, b) => a.order - b.order)
    .map((plugin) => plugin.package);
  const enabledMcp = sources.mcp.servers.filter((server) => server.enabled);

  const opencode = {
    $schema: 'https://opencode.ai/config.json',
    model: defaultAgent ? modelRef(renderedProviders, defaultAgent[1].primary.provider, defaultAgent[1].primary.model) : 'openai/gpt-4o-mini',
    small_model: smallAgent ? modelRef(renderedProviders, smallAgent[1].primary.provider, smallAgent[1].primary.model) : 'openai/gpt-4o-mini',
    provider: Object.fromEntries(
      renderedProviders.map((provider) => {
        const config = {
          npm: providerNpm(provider),
          options: providerOptions(provider),
          ...(renderProviderModels(provider) ? { models: renderProviderModels(provider) } : {}),
          ...(renderProviderWhitelist(provider) ? { whitelist: renderProviderWhitelist(provider) } : {}),
        };

        return [runtimeProviderKey(provider), config];
      })
    ),
    plugin: enabledPlugins,
    mcp: Object.fromEntries(enabledMcp.map((server) => [server.id, renderMcpServer(server)])),
    permission: {
      skill: 'allow',
      edit: 'ask',
      bash: 'ask',
    },
  };

  const activePreset = sources.routing.defaultPreset || 'default';
  const agentPreset = Object.fromEntries(
    Object.entries(sources.routing.agents).filter(([, agent]) => agent.enabled).map(([id, agent]) => [
      id,
      {
        model: modelRef(renderedProviders, agent.primary.provider, agent.primary.model),
        ...(agent.skillsPolicy === 'all'
          ? { skills: ['*'] }
          : agent.skillsPolicy === 'selected'
            ? { skills: agent.skillsAllowlist }
            : { skills: [] }),
        ...(agent.mcpAccess === 'all'
          ? { mcps: ['*'] }
          : agent.mcpAccess === 'selected'
            ? { mcps: agent.mcpAllowlist }
            : { mcps: [] }),
      },
    ])
  );

  // Build all presets, not just the active one
  const allAgentPresets: Record<string, Record<string, unknown>> = {};
  for (const [presetId] of Object.entries(sources.routing.presets)) {
    // For now, all presets render the same agent models (they share one agent routing config)
    // The activePreset is the "live" one; others get the same agent map as a starting point
    allAgentPresets[presetId] = agentPreset;
  }
  // Ensure the active preset is always included (in case presets map is empty)
  allAgentPresets[activePreset] = agentPreset;

  const slimObject: Record<string, unknown> = {
    preset: activePreset,
    presets: allAgentPresets,
    tmux: {
      enabled: true,
      layout: 'main-vertical',
    },
  };

  if (sources.routing.council) {
    slimObject.council = sources.routing.council;
  }

  const ohMySlim = `{// Managed by opencode-admin\n${JSON.stringify(slimObject, null, 2).slice(1)}`;

  // Build per-preset slim configs
  const ohMySlims: Record<string, string> = {};
  for (const [presetId] of Object.entries(sources.routing.presets)) {
    const presetSlimObject: Record<string, unknown> = {
      preset: presetId,
      presets: { [presetId]: agentPreset },
      tmux: { enabled: true, layout: 'main-vertical' },
    };
    if (sources.routing.council) {
      presetSlimObject.council = sources.routing.council;
    }
    ohMySlims[presetId] = `{// Managed by opencode-admin — preset: ${presetId}\n${JSON.stringify(presetSlimObject, null, 2).slice(1)}`;
  }
  // Also store under the active preset key for canonical access
  ohMySlims[activePreset] = ohMySlim;

  return { opencode, ohMySlim, ohMySlims };
}

export function makeReleaseId(): string {
  return `release-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
}
