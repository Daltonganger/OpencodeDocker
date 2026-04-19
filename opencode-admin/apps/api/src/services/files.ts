import fs from 'fs/promises';
import path from 'path';
import type {
  AgentId,
  AgentRouteConfig,
  CombinedSources,
  FeaturesSource,
  McpServerEntry,
  McpSource,
  OAuthSource,
  PluginsSource,
  PluginEntry,
  ProvidersSource,
  ProviderEntry,
  ReleaseInfo,
  ReleaseMetadata,
  RoutingSource,
  SecretStatusEntry,
  SecretsRefsSource,
} from '../types/index.js';
import { AGENT_IDS } from '../types/index.js';
import { config } from './config.js';

function isBuiltInAgentId(id: string): id is AgentId {
  return AGENT_IDS.includes(id as AgentId);
}

function sanitizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await fs.rename(tempPath, filePath);
}

async function writeTextFile(filePath: string, value: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, value, 'utf8');
  await fs.rename(tempPath, filePath);
}

async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

function defaultRoutingSource(): RoutingSource {
  const agents = {} as Record<string, AgentRouteConfig>;
  for (const id of AGENT_IDS) {
    agents[id] = {
      enabled: true,
      displayName: id.charAt(0).toUpperCase() + id.slice(1),
      description: `${id} agent`,
      primary: { provider: 'google', model: 'antigravity-gemini-3-pro' },
      fallback: { provider: 'openrouter', model: 'openai/gpt-4o-mini' },
      temperature: 0.4,
      maxReasoningEffort: 'medium',
      mcpAccess: 'all',
      mcpAllowlist: [],
      mcpDenylist: [],
      skillsPolicy: 'all',
      skillsAllowlist: [],
      skillsDenylist: [],
      tmux: { enabled: true, sessionPrefix: id.slice(0, 3) },
    };
  }

  return {
    version: '1.0.0',
    defaultPreset: 'default',
    agents,
    presets: {
      default: { name: 'Default', description: 'Default admin routing preset' },
    },
    metadata: { modifiedBy: 'system', lastModified: new Date().toISOString() },
  };
}

function defaultPluginsSource(): PluginsSource {
  return { version: '1.0.0', plugins: [], metadata: { modifiedBy: 'system', lastModified: new Date().toISOString() } };
}

function defaultProvidersSource(): ProvidersSource {
  return { version: '1.0.0', providers: [], functionalAliases: {}, metadata: { modifiedBy: 'system', lastModified: new Date().toISOString() } };
}

function defaultMcpSource(): McpSource {
  return { version: '1.0.0', servers: [], metadata: { modifiedBy: 'system', lastModified: new Date().toISOString() } };
}

function defaultOauthSource(): OAuthSource {
  return { version: '1.0.0', providers: {}, status: {}, metadata: { modifiedBy: 'system', lastModified: new Date().toISOString() } };
}

function defaultFeaturesSource(): FeaturesSource {
  return { version: '1.0.0', flags: {}, metadata: { modifiedBy: 'system', lastModified: new Date().toISOString() } };
}

function defaultSecretsRefsSource(): SecretsRefsSource {
  return { version: '1.0.0', secrets: [], categories: {}, metadata: { modifiedBy: 'system', lastModified: new Date().toISOString() } };
}

export async function ensureBaseStructure(): Promise<void> {
  await Promise.all([
    ensureDir(config.sourcesDir),
    ensureDir(config.generatedDir),
    ensureDir(config.releasesDir),
  ]);
}

export async function getRoutingSource(): Promise<RoutingSource> {
  return readJsonFile(config.routingSourcePath, defaultRoutingSource());
}

export async function saveRoutingSource(source: RoutingSource): Promise<void> {
  source.metadata = { ...(source.metadata ?? {}), lastModified: new Date().toISOString(), modifiedBy: 'opencode-admin' };
  await writeJsonFile(config.routingSourcePath, source);
}

export async function listAgents(): Promise<Array<AgentRouteConfig & { id: string; builtIn: boolean }>> {
  const source = await getRoutingSource();
  const entries = Object.entries(source.agents).map(([id, agent]) => ({ id, builtIn: isBuiltInAgentId(id), ...agent }));
  return entries.sort((a, b) => {
    if (a.builtIn !== b.builtIn) return a.builtIn ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

export async function getAgent(id: string): Promise<(AgentRouteConfig & { id: string; builtIn: boolean }) | null> {
  const source = await getRoutingSource();
  const agent = source.agents[id];
  return agent ? { id, builtIn: isBuiltInAgentId(id), ...agent } : null;
}

export async function createAgent(input: { id: string } & AgentRouteConfig): Promise<AgentRouteConfig & { id: string; builtIn: boolean }> {
  const source = await getRoutingSource();
  const id = sanitizeId(input.id);
  if (!id) {
    throw new Error('Agent id is required');
  }
  if (source.agents[id]) {
    throw new Error('Agent id already exists');
  }
  source.agents[id] = {
    ...input,
    displayName: input.displayName.trim() || id,
  };
  await saveRoutingSource(source);
  return { id, builtIn: false, ...source.agents[id] };
}

export async function updateAgent(id: string, patch: Partial<AgentRouteConfig>): Promise<AgentRouteConfig & { id: string; builtIn: boolean }> {
  const source = await getRoutingSource();
  if (!source.agents[id]) {
    throw new Error('Agent not found');
  }
  source.agents[id] = {
    ...source.agents[id],
    ...patch,
    primary: { ...source.agents[id].primary, ...(patch.primary ?? {}) },
    fallback: { ...source.agents[id].fallback, ...(patch.fallback ?? {}) },
    tmux: { ...source.agents[id].tmux, ...(patch.tmux ?? {}) },
  };
  await saveRoutingSource(source);
  return { id, builtIn: isBuiltInAgentId(id), ...source.agents[id] };
}

export async function deleteAgent(id: string): Promise<boolean> {
  if (isBuiltInAgentId(id)) return false;
  const source = await getRoutingSource();
  if (!source.agents[id]) return false;
  delete source.agents[id];
  await saveRoutingSource(source);
  return true;
}

export async function getPluginsSource(): Promise<PluginsSource> {
  return readJsonFile(config.pluginsSourcePath, defaultPluginsSource());
}

export async function savePluginsSource(source: PluginsSource): Promise<void> {
  source.metadata = { ...(source.metadata ?? {}), lastModified: new Date().toISOString(), modifiedBy: 'opencode-admin' };
  await writeJsonFile(config.pluginsSourcePath, source);
}

export async function listPlugins(): Promise<PluginEntry[]> {
  const source = await getPluginsSource();
  return [...source.plugins].sort((a, b) => a.order - b.order);
}

export async function updatePlugin(id: string, patch: Partial<PluginEntry>): Promise<PluginEntry | null> {
  const source = await getPluginsSource();
  const index = source.plugins.findIndex((plugin) => plugin.id === id);
  if (index === -1) return null;
  source.plugins[index] = { ...source.plugins[index], ...patch };
  await savePluginsSource(source);
  return source.plugins[index];
}

export async function createPlugin(input: PluginEntry): Promise<PluginEntry> {
  const source = await getPluginsSource();
  if (!input.id.trim()) throw new Error('Plugin id is required');
  if (source.plugins.some((plugin) => plugin.id === input.id)) throw new Error('Plugin id already exists');
  source.plugins.push(input);
  await savePluginsSource(source);
  return input;
}

export async function deletePlugin(id: string): Promise<boolean> {
  const source = await getPluginsSource();
  const index = source.plugins.findIndex((plugin) => plugin.id === id);
  if (index === -1) return false;
  source.plugins.splice(index, 1);
  await savePluginsSource(source);
  return true;
}

export async function getProvidersSource(): Promise<ProvidersSource> {
  return readJsonFile(config.providersSourcePath, defaultProvidersSource());
}

export async function saveProvidersSource(source: ProvidersSource): Promise<void> {
  source.metadata = { ...(source.metadata ?? {}), lastModified: new Date().toISOString(), modifiedBy: 'opencode-admin' };
  await writeJsonFile(config.providersSourcePath, source);
}

export async function listProviders(): Promise<ProviderEntry[]> {
  const source = await getProvidersSource();
  const envEntries = await readEnvFile();
  return source.providers.map((provider) => {
    if (provider.secretRef && !envEntries[provider.secretRef]) {
      return { ...provider, enabled: false, metadata: { ...(provider.metadata ?? {}), autoDisabledMissingSecret: true } };
    }
    return provider;
  });
}

export async function updateProvider(id: string, patch: Partial<ProviderEntry>): Promise<ProviderEntry | null> {
  const source = await getProvidersSource();
  const index = source.providers.findIndex((provider) => provider.id === id);
  if (index === -1) return null;
  const envEntries = await readEnvFile();
  const nextProvider = { ...source.providers[index], ...patch };
  if (nextProvider.secretRef && !envEntries[nextProvider.secretRef]) {
    nextProvider.enabled = false;
    nextProvider.metadata = { ...(nextProvider.metadata ?? {}), autoDisabledMissingSecret: true };
  }
  source.providers[index] = nextProvider;
  await saveProvidersSource(source);
  return source.providers[index];
}

export async function getMcpSource(): Promise<McpSource> {
  return readJsonFile(config.mcpSourcePath, defaultMcpSource());
}

export async function saveMcpSource(source: McpSource): Promise<void> {
  source.metadata = { ...(source.metadata ?? {}), lastModified: new Date().toISOString(), modifiedBy: 'opencode-admin' };
  await writeJsonFile(config.mcpSourcePath, source);
}

export async function listMcpServers(): Promise<McpServerEntry[]> {
  const source = await getMcpSource();
  return source.servers;
}

export async function updateMcpServer(id: string, patch: Partial<McpServerEntry>): Promise<McpServerEntry | null> {
  const source = await getMcpSource();
  const index = source.servers.findIndex((server) => server.id === id);
  if (index === -1) return null;
  source.servers[index] = { ...source.servers[index], ...patch };
  await saveMcpSource(source);
  return source.servers[index];
}

export async function createMcpServer(input: McpServerEntry): Promise<McpServerEntry> {
  const source = await getMcpSource();
  if (!input.id.trim()) throw new Error('MCP server id is required');
  if (source.servers.some((server) => server.id === input.id)) throw new Error('MCP server id already exists');
  source.servers.push(input);
  await saveMcpSource(source);
  return input;
}

export async function deleteMcpServer(id: string): Promise<boolean> {
  const source = await getMcpSource();
  const index = source.servers.findIndex((server) => server.id === id);
  if (index === -1) return false;
  source.servers.splice(index, 1);
  await saveMcpSource(source);
  return true;
}

export async function getOAuthSource(): Promise<OAuthSource> {
  return readJsonFile(config.oauthSourcePath, defaultOauthSource());
}

export async function saveOAuthSource(source: OAuthSource): Promise<void> {
  source.metadata = { ...(source.metadata ?? {}), lastModified: new Date().toISOString(), modifiedBy: 'opencode-admin' };
  await writeJsonFile(config.oauthSourcePath, source);
}

export async function getFeaturesSource(): Promise<FeaturesSource> {
  return readJsonFile(config.featuresSourcePath, defaultFeaturesSource());
}

export async function saveFeaturesSource(source: FeaturesSource): Promise<void> {
  source.metadata = { ...(source.metadata ?? {}), lastModified: new Date().toISOString(), modifiedBy: 'opencode-admin' };
  await writeJsonFile(config.featuresSourcePath, source);
}

export async function getSecretsRefsSource(): Promise<SecretsRefsSource> {
  return readJsonFile(config.secretsRefsSourcePath, defaultSecretsRefsSource());
}

export async function saveSecretsRefsSource(source: SecretsRefsSource): Promise<void> {
  source.metadata = { ...(source.metadata ?? {}), lastModified: new Date().toISOString(), modifiedBy: 'opencode-admin' };
  await writeJsonFile(config.secretsRefsSourcePath, source);
}

export async function getCombinedSources(): Promise<CombinedSources> {
  const [routing, plugins, providers, mcp, oauth, features, secretsRefs] = await Promise.all([
    getRoutingSource(),
    getPluginsSource(),
    getProvidersSource(),
    getMcpSource(),
    getOAuthSource(),
    getFeaturesSource(),
    getSecretsRefsSource(),
  ]);

  return { routing, plugins, providers, mcp, oauth, features, secretsRefs };
}

export async function saveCombinedSources(partial: Partial<CombinedSources>): Promise<void> {
  if (partial.routing) await saveRoutingSource(partial.routing);
  if (partial.plugins) await savePluginsSource(partial.plugins);
  if (partial.providers) await saveProvidersSource(partial.providers);
  if (partial.mcp) await saveMcpSource(partial.mcp);
  if (partial.oauth) await saveOAuthSource(partial.oauth);
  if (partial.features) await saveFeaturesSource(partial.features);
  if (partial.secretsRefs) await saveSecretsRefsSource(partial.secretsRefs);
}

export async function readEnvFile(): Promise<Record<string, string>> {
  const content = await readTextFile(config.targetEnvPath);
  if (!content) return {};
  const entries: Record<string, string> = {};
  for (const line of content.split('\n')) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    entries[key.trim()] = rest.join('=').trim();
  }
  return entries;
}

async function writeEnvFile(entries: Record<string, string>): Promise<void> {
  const content = Object.entries(entries)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  await writeTextFile(config.targetEnvPath, `${content}\n`);
}

function maskValue(value: string): string {
  if (!value) return 'missing';
  if (value.length <= 6) return `${value[0] ?? '*'}***`;
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

export async function getSecretStatuses(): Promise<SecretStatusEntry[]> {
  const [envEntries, refs] = await Promise.all([readEnvFile(), getSecretsRefsSource()]);
  return refs.secrets.map((entry) => {
    const value = envEntries[entry.key] ?? '';
    return {
      key: entry.key,
      category: entry.category,
      displayName: entry.displayName,
      description: entry.description,
      required: entry.required,
      configured: value.length > 0,
      maskedValue: value ? maskValue(value) : 'missing',
      source: value ? 'env' : 'missing',
      docs: typeof entry.metadata?.docs === 'string' ? entry.metadata.docs : undefined,
    };
  });
}

export async function getRegisteredSecretKeys(): Promise<Set<string>> {
  const refs = await getSecretsRefsSource();
  return new Set(refs.secrets.map((entry) => entry.key));
}

async function upsertEnvLine(key: string, value: string): Promise<void> {
  const existing = await readTextFile(config.targetEnvPath);
  const lines = (existing ?? '').split('\n');
  let updated = false;
  const nextLines = lines.map((line) => {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) return line;
    const [lineKey] = line.split('=', 1);
    if (lineKey.trim() !== key) return line;
    updated = true;
    return `${key}=${value}`;
  });

  if (!updated) {
    if (nextLines.length && nextLines[nextLines.length - 1] !== '') nextLines.push('');
    nextLines.push(`${key}=${value}`);
  }

  await writeTextFile(config.targetEnvPath, `${nextLines.filter((line, index, arr) => !(index === arr.length - 1 && line === '')).join('\n')}\n`);
}

async function deleteEnvLine(key: string): Promise<boolean> {
  const existing = await readTextFile(config.targetEnvPath);
  if (!existing) return false;
  let removed = false;
  const nextLines = existing.split('\n').filter((line) => {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) return true;
    const [lineKey] = line.split('=', 1);
    if (lineKey.trim() !== key) return true;
    removed = true;
    return false;
  });

  if (removed) {
    await writeTextFile(config.targetEnvPath, `${nextLines.join('\n').replace(/\n+$/, '')}\n`);
  }

  return removed;
}

export async function setSecretValue(key: string, value: string): Promise<SecretStatusEntry | null> {
  await upsertEnvLine(key, value);
  const statuses = await getSecretStatuses();
  return statuses.find((status) => status.key === key) ?? null;
}

export async function deleteSecretValue(key: string): Promise<boolean> {
  return deleteEnvLine(key);
}

export async function readGeneratedOpenCode(): Promise<Record<string, unknown> | null> {
  return readJsonFile<Record<string, unknown> | null>(config.openCodeJsonPath, null);
}

export async function readGeneratedOhMyOpenCodeText(): Promise<string | null> {
  return readTextFile(config.ohMyOpenCodeSlimPath);
}

export async function readCurrentTargetOpenCodeText(): Promise<string | null> {
  return readTextFile(config.targetOpenCodeJsonPath);
}

export async function readCurrentTargetSlimText(): Promise<string | null> {
  return readTextFile(config.targetOhMySlimPath);
}

export async function readCurrentTargetSlimPresetText(presetId: string): Promise<string | null> {
  const presetPath = path.join(path.dirname(config.targetOhMySlimPath), `oh-my-opencode-slim.${presetId}.jsonc`);
  return readTextFile(presetPath);
}

export async function writeRenderedFiles(rendered: { openCode: Record<string, unknown>; ohMySlim: string; ohMySlims?: Record<string, string> }): Promise<{ paths: string[]; targetWritten: boolean }> {
  const openCodeText = JSON.stringify(rendered.openCode, null, 2) + '\n';
  await Promise.all([
    writeTextFile(config.openCodeJsonPath, openCodeText),
    writeTextFile(config.ohMyOpenCodeSlimPath, rendered.ohMySlim),
  ]);

  const written = [config.openCodeJsonPath, config.ohMyOpenCodeSlimPath];
  let targetWritten = false;

  if (await pathExists(path.dirname(config.targetOpenCodeJsonPath))) {
    const writes: Array<Promise<void>> = [
      writeTextFile(config.targetOpenCodeJsonPath, openCodeText),
      writeTextFile(config.targetOhMySlimPath, rendered.ohMySlim),
    ];

    if (await pathExists(config.targetOpenCodeTemplatePath)) {
      writes.push(writeTextFile(config.targetOpenCodeTemplatePath, openCodeText));
    }

    if (await pathExists(config.targetOhMySlimTemplatePath)) {
      writes.push(writeTextFile(config.targetOhMySlimTemplatePath, rendered.ohMySlim));
    }

    await Promise.all(writes);
    written.push(config.targetOpenCodeJsonPath, config.targetOhMySlimPath);
    if (await pathExists(config.targetOpenCodeTemplatePath)) {
      written.push(config.targetOpenCodeTemplatePath);
    }
    if (await pathExists(config.targetOhMySlimTemplatePath)) {
      written.push(config.targetOhMySlimTemplatePath);
    }
    targetWritten = true;
  }

  // Write per-preset slim configs
  if (rendered.ohMySlims) {
    for (const [presetId, slimContent] of Object.entries(rendered.ohMySlims)) {
      const localPath = path.join(config.generatedDir, `oh-my-opencode-slim.${presetId}.jsonc`);
      await writeTextFile(localPath, slimContent);
      written.push(localPath);
      if (await pathExists(path.dirname(config.targetOhMySlimPath))) {
        const targetPath = path.join(path.dirname(config.targetOhMySlimPath), `oh-my-opencode-slim.${presetId}.jsonc`);
        await writeTextFile(targetPath, slimContent);
        written.push(targetPath);
      }
    }
  }

  return { paths: written, targetWritten };
}

export async function getReleaseMetadata(): Promise<ReleaseMetadata> {
  return readJsonFile(config.releaseMetadataPath, { current: null, history: [] });
}

export async function saveReleaseMetadata(metadata: ReleaseMetadata): Promise<void> {
  await writeJsonFile(config.releaseMetadataPath, metadata);
}

export async function releaseExists(releaseId: string): Promise<boolean> {
  return pathExists(path.join(config.releasesDir, releaseId));
}

export async function writeReleaseSnapshot(release: ReleaseInfo, rendered: { openCode: Record<string, unknown>; ohMySlim: string; ohMySlims?: Record<string, string> }): Promise<void> {
  const releaseDir = path.join(config.releasesDir, release.id);
  await ensureDir(releaseDir);
  await writeTextFile(path.join(releaseDir, 'opencode.json'), JSON.stringify(rendered.openCode, null, 2) + '\n');
  await writeTextFile(path.join(releaseDir, 'oh-my-opencode-slim.jsonc'), rendered.ohMySlim);
  if (rendered.ohMySlims) {
    for (const [presetId, content] of Object.entries(rendered.ohMySlims)) {
      await writeTextFile(path.join(releaseDir, `oh-my-opencode-slim.${presetId}.jsonc`), content);
    }
  }
  await writeJsonFile(path.join(releaseDir, 'release.json'), release);
}

export async function captureCurrentIntoRelease(releaseId: string, summary: string): Promise<void> {
  const [openCodeText, slimText] = await Promise.all([readCurrentTargetOpenCodeText(), readCurrentTargetSlimText()]);
  if (!openCodeText && !slimText) return;
  const releaseDir = path.join(config.releasesDir, releaseId);
  await ensureDir(releaseDir);
  if (openCodeText) await writeTextFile(path.join(releaseDir, 'opencode.json'), openCodeText);
  if (slimText) await writeTextFile(path.join(releaseDir, 'oh-my-opencode-slim.jsonc'), slimText);
  await writeJsonFile(path.join(releaseDir, 'release.json'), {
    id: releaseId,
    timestamp: new Date().toISOString(),
    summary,
    files: ['opencode.json', 'oh-my-opencode-slim.jsonc'],
    restartTriggered: false,
  } satisfies ReleaseInfo);
}

export async function restoreRelease(releaseId: string): Promise<string[]> {
  const releaseDir = path.join(config.releasesDir, releaseId);
  const written: string[] = [];
  const openCodeText = await readTextFile(path.join(releaseDir, 'opencode.json'));
  const slimText = await readTextFile(path.join(releaseDir, 'oh-my-opencode-slim.jsonc'));
  if (openCodeText) {
    await writeTextFile(config.openCodeJsonPath, openCodeText);
    if (await pathExists(path.dirname(config.targetOpenCodeJsonPath))) {
      await writeTextFile(config.targetOpenCodeJsonPath, openCodeText);
    }
    written.push('opencode.json');
  }
  if (slimText) {
    await writeTextFile(config.ohMyOpenCodeSlimPath, slimText);
    if (await pathExists(path.dirname(config.targetOhMySlimPath))) {
      await writeTextFile(config.targetOhMySlimPath, slimText);
    }
    written.push('oh-my-opencode-slim.jsonc');
  }
  return written;
}

export function makeReleaseInfo(partial: Omit<ReleaseInfo, 'timestamp'>): ReleaseInfo {
  return { ...partial, timestamp: new Date().toISOString() };
}
