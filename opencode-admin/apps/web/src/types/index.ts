export const AGENT_IDS = ['orchestrator', 'explorer', 'oracle', 'librarian', 'designer', 'fixer'] as const;
export type BuiltInAgentId = (typeof AGENT_IDS)[number];

export interface AgentConfig {
  id: string;
  builtIn?: boolean;
  enabled: boolean;
  displayName: string;
  description: string;
  primary: { provider: string; model: string };
  fallback: { provider: string; model: string };
  temperature: number;
  maxReasoningEffort: 'low' | 'medium' | 'high';
  mcpAccess: 'all' | 'selected' | 'none';
  mcpAllowlist: string[];
  mcpDenylist: string[];
  skillsPolicy: 'all' | 'selected' | 'none';
  skillsAllowlist: string[];
  skillsDenylist: string[];
  tmux: { enabled: boolean; sessionPrefix: string };
}

export interface PluginConfig {
  id: string;
  name: string;
  package: string;
  enabled: boolean;
  order: number;
  version: string;
  description: string;
  required?: boolean;
}

export interface ProviderModel {
  id: string;
  name: string;
  capabilities: string[];
  recommended?: boolean;
  visibleInOpencode?: boolean;
  limit?: {
    context?: number;
    output?: number;
  };
  pricing?: {
    input?: number;
    output?: number;
    currency?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface ProviderConfig {
  id: string;
  alias: string;
  name: string;
  type: string;
  baseUrl: string;
  enabled: boolean;
  secretRef: string;
  models: ProviderModel[];
  defaultModel: string;
  metadata?: Record<string, unknown>;
}

export interface ProvidersSourceConfig {
  version: string;
  providers: ProviderConfig[];
  functionalAliases?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface ProviderSyncResult {
  provider: ProviderConfig;
  syncedCount: number;
  sourceUrl: string;
}

export interface MCPServer {
  id: string;
  name: string;
  enabled: boolean;
  type: 'local' | 'remote';
  command?: string;
  args?: string[];
  url?: string;
  envRefs: string[];
  transport: 'stdio' | 'http' | 'sse';
  description?: string;
  capabilities?: string[];
  testProfile?: {
    timeout: number;
    testCommand: string;
  };
}

export interface OAuthConfig {
  id: string;
  displayName: string;
  enabled: boolean;
  clientIdRef?: string;
  clientSecretRef?: string;
  scopes: string[];
  callbackPath?: string;
  callbackUrl?: string;
  configured: boolean;
  connected: boolean;
  lastChecked: string | null;
  tokenExpiry: string | null;
  error: string | null;
  accountCount?: number;
  accountSummary?: string;
  loginUrl?: string;
  loginLabel?: string;
  loginEnabled?: boolean;
  loginMode?: 'direct' | 'browser';
}

export interface Secret {
  key: string;
  category: string;
  displayName: string;
  description: string;
  required: boolean;
  configured: boolean;
  maskedValue: string;
  source: 'env' | 'missing';
  docs?: string;
}

export interface CouncilMasterConfig {
  model: string;
  variant?: string;
  prompt?: string;
}

export interface CouncilCouncillorConfig {
  model: string;
  variant?: string;
  prompt?: string;
}

export interface CouncilPreset {
  master?: { model?: string; variant?: string; prompt?: string };
  [councillorName: string]: CouncilCouncillorConfig | { model?: string; variant?: string; prompt?: string } | undefined;
}

export interface CouncilConfig {
  master: CouncilMasterConfig;
  presets: Record<string, CouncilPreset>;
  default_preset?: string;
  master_timeout?: number;
  councillors_timeout?: number;
  master_fallback?: string[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ApplyStatus {
  dirty: boolean;
  pendingFiles: number;
  pendingChanges: string[];
  lastApplied: string | null;
  validation: ValidationResult;
}

export interface ChangeSummary {
  id: string;
  type: 'update';
  resource: string;
  description: string;
}

export interface ApplyResult {
  releaseId: string;
  timestamp: string;
  filesWritten: string[];
  validation: ValidationResult;
  appliedChanges: ChangeSummary[];
  warnings: string[];
  restartTriggered: boolean;
}

export interface OpencodeRuntimeInfo {
  version: string | null;
  upstreamRelease: string | null;
  source: string | null;
}

export interface OpencodeUpdateStatus {
  running: boolean;
  startedAt: string | null;
  completedAt: string | null;
  exitCode: number | null;
  success: boolean | null;
  message: string;
  log: string;
  runtime: OpencodeRuntimeInfo;
}

export interface DashboardStats {
  currentRelease: ReleaseInfo | null;
  dirty: boolean;
  targetStackPath: string;
  lastApplied: string | null;
  stats: {
    agents: { total: number; enabled: number };
    plugins: { total: number; enabled: number };
    providers: { total: number; enabled: number };
    mcpServers: { total: number; enabled: number };
    oauth: { total: number; configured: number; connected: number };
    secrets: { total: number; configured: number; missing: number };
  };
  pendingChanges: string[];
}

export interface ReleaseInfo {
  id: string;
  timestamp: string;
  summary: string;
  files: string[];
  restartTriggered: boolean;
  previousReleaseId?: string;
}

export interface DiffSummary {
  text: string;
  files: Array<{ file: string; summary: string; changes: number }>;
}

export interface CombinedConfig {
  routing: Record<string, unknown>;
  plugins: Record<string, unknown>;
  providers: ProvidersSourceConfig;
  mcp: Record<string, unknown>;
  oauth: Record<string, unknown>;
  features: Record<string, unknown>;
  secretsRefs: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
