import type {
  AgentConfig,
  ApiResponse,
  ApplyResult,
  ApplyStatus,
  CombinedConfig,
  DashboardStats,
  DiffSummary,
  MCPServer,
  OAuthConfig,
  OpencodeUpdateStatus,
  PluginConfig,
  ProviderConfig,
  ProviderSyncResult,
  ProvidersSourceConfig,
  ReleaseInfo,
  Secret,
  ValidationResult,
} from '@/types';

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/v1`;

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const hasBody = options?.body !== undefined && options?.body !== null;
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  });

  const payload = await response.json().catch(() => ({ success: false, error: 'Invalid API response' }));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload as ApiResponse<T>;
}

export const getDashboardStats = () => fetchApi<DashboardStats>('/dashboard');

export const getAgents = () => fetchApi<AgentConfig[]>('/agents');
export const getAgent = (id: string) => fetchApi<AgentConfig>(`/agents/${id}`);
export const createAgent = (data: AgentConfig) =>
  fetchApi<AgentConfig>('/agents', { method: 'POST', body: JSON.stringify(data) });
export const updateAgent = (id: string, data: Partial<AgentConfig>) =>
  fetchApi<AgentConfig>(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteAgent = (id: string) =>
  fetchApi<{ id: string }>(`/agents/${id}`, { method: 'DELETE' });

export const getPlugins = () => fetchApi<PluginConfig[]>('/plugins');
export const createPlugin = (data: PluginConfig) =>
  fetchApi<PluginConfig>('/plugins', { method: 'POST', body: JSON.stringify(data) });
export const updatePlugin = (id: string, data: Partial<PluginConfig>) =>
  fetchApi<PluginConfig>(`/plugins/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const togglePlugin = (id: string, enabled: boolean) =>
  fetchApi<PluginConfig>(`/plugins/${id}/toggle`, { method: 'POST', body: JSON.stringify({ enabled }) });
export const deletePlugin = (id: string) =>
  fetchApi<{ id: string }>(`/plugins/${id}`, { method: 'DELETE' });

export const getProviders = () => fetchApi<ProviderConfig[]>('/providers');
export const updateProvider = (id: string, data: Partial<ProviderConfig>) =>
  fetchApi<ProviderConfig>(`/providers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const toggleProvider = (id: string, enabled: boolean) =>
  fetchApi<ProviderConfig>(`/providers/${id}/toggle`, { method: 'POST', body: JSON.stringify({ enabled }) });
export const syncProviderModels = (id: string) =>
  fetchApi<ProviderSyncResult>(`/providers/${id}/sync-models`, { method: 'POST' });

export const getProvidersSource = async () => {
  const response = await getFullConfig();
  return { success: true as const, data: response.data.providers as ProvidersSourceConfig };
};
export const updateProvidersSource = (providers: ProvidersSourceConfig) =>
  updateFullConfig({ providers });

export const getMCPServers = () => fetchApi<MCPServer[]>('/mcp');
export const createMCPServer = (data: MCPServer) =>
  fetchApi<MCPServer>('/mcp', { method: 'POST', body: JSON.stringify(data) });
export const updateMCPServer = (id: string, data: Partial<MCPServer>) =>
  fetchApi<MCPServer>(`/mcp/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const toggleMCPServer = (id: string, enabled: boolean) =>
  fetchApi<MCPServer>(`/mcp/${id}/toggle`, { method: 'POST', body: JSON.stringify({ enabled }) });
export const testMCPServer = (id: string) => fetchApi<{ id: string; ok: boolean; message: string }>(`/mcp/${id}/test`, { method: 'POST' });
export const deleteMCPServer = (id: string) =>
  fetchApi<{ id: string }>(`/mcp/${id}`, { method: 'DELETE' });

export const getOAuthConfigs = () => fetchApi<OAuthConfig[]>('/oauth');
export const updateOAuthConfig = (id: string, data: Partial<OAuthConfig>) =>
  fetchApi<Record<string, unknown>>(`/oauth/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const getSecrets = () => fetchApi<Secret[]>('/secrets');
export const setSecret = (key: string, value: string) => fetchApi<Secret>('/secrets', { method: 'POST', body: JSON.stringify({ key, value }) });
export const deleteSecret = (key: string) => fetchApi<{ key: string }>(`/secrets/${key}`, { method: 'DELETE' });

export const getApplyStatus = () => fetchApi<ApplyStatus>('/apply/status');
export const applyChanges = () => fetchApi<ApplyResult>('/apply', { method: 'POST' });
export const validateChanges = () => fetchApi<ValidationResult>('/validate', { method: 'POST' });
export const getDiff = () => fetchApi<string>('/apply/diff');
export const getDiffSummary = () => fetchApi<DiffSummary>('/diff');
export const rollbackLast = () => fetchApi<{ fromReleaseId: string | null; toReleaseId: string; filesRestored: string[]; timestamp: string }>('/rollback/last', { method: 'POST' });
export const getReleases = () => fetchApi<{ current: ReleaseInfo | null; history: ReleaseInfo[] }>('/releases');
export const getOpencodeUpdateStatus = () => fetchApi<OpencodeUpdateStatus>('/update/status');
export const triggerOpencodeUpdate = () => fetchApi<OpencodeUpdateStatus>('/update/opencode', { method: 'POST' });

export const getFullConfig = () => fetchApi<CombinedConfig>('/config');
export const updateFullConfig = (config: Partial<CombinedConfig>) =>
  fetchApi<CombinedConfig>('/config', { method: 'PUT', body: JSON.stringify(config) });
