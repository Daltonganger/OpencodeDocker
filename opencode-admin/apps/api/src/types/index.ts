export const AGENT_IDS = [
  'orchestrator',
  'explorer',
  'oracle',
  'librarian',
  'designer',
  'fixer',
] as const;

export type AgentId = (typeof AGENT_IDS)[number];
export type BuiltInAgentId = AgentId;

export interface Metadata {
  lastModified?: string;
  modifiedBy?: string;
  [key: string]: unknown;
}

export interface AgentModelRef {
  provider: string;
  model: string;
}

export interface AgentRouteConfig {
  enabled: boolean;
  displayName: string;
  description: string;
  primary: AgentModelRef;
  fallback: AgentModelRef;
  temperature: number;
  maxReasoningEffort: 'low' | 'medium' | 'high';
  mcpAccess: 'all' | 'selected' | 'none';
  mcpAllowlist: string[];
  mcpDenylist: string[];
  skillsPolicy: 'all' | 'selected' | 'none';
  skillsAllowlist: string[];
  skillsDenylist: string[];
  tmux: {
    enabled: boolean;
    sessionPrefix: string;
  };
  metadata?: Record<string, unknown>;
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
  master?: Omit<CouncilMasterConfig, 'model'> & { model?: string };
  [councillorName: string]: CouncilCouncillorConfig | (Omit<CouncilMasterConfig, 'model'> & { model?: string }) | undefined;
}

export interface CouncilConfig {
  master: CouncilMasterConfig;
  presets: Record<string, CouncilPreset>;
  default_preset?: string;
  master_timeout?: number;
  councillors_timeout?: number;
  master_fallback?: string[];
}

export interface RoutingSource {
  version: string;
  defaultPreset: string;
  agents: Record<string, AgentRouteConfig>;
  presets: Record<string, { name: string; description: string }>;
  council?: CouncilConfig;
  metadata?: Metadata;
}

export interface PluginEntry {
  id: string;
  name: string;
  package: string;
  enabled: boolean;
  order: number;
  version: string;
  description: string;
  required?: boolean;
}

export interface PluginsSource {
  version: string;
  plugins: PluginEntry[];
  metadata?: Metadata;
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

export interface ProviderEntry {
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

export interface ProvidersSource {
  version: string;
  providers: ProviderEntry[];
  functionalAliases?: Record<string, string>;
  metadata?: Metadata;
}

export interface McpServerEntry {
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

export interface McpSource {
  version: string;
  servers: McpServerEntry[];
  metadata?: Metadata;
}

export interface OAuthProviderSource {
  enabled: boolean;
  displayName: string;
  clientIdRef?: string;
  clientSecretRef?: string;
  scopes: string[];
  callbackPath?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface OAuthProviderStatus {
  configured: boolean;
  connected: boolean;
  lastChecked: string | null;
  tokenExpiry: string | null;
  error: string | null;
}

export interface OAuthSource {
  version: string;
  providers: Record<string, OAuthProviderSource>;
  status: Record<string, OAuthProviderStatus>;
  metadata?: Metadata;
}

export interface OAuthStatusEntry {
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
  metadata?: Record<string, unknown>;
}

export interface SecretRefEntry {
  key: string;
  category: string;
  displayName: string;
  description: string;
  required: boolean;
  maskPattern?: string;
  validation?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SecretsRefsSource {
  version: string;
  secrets: SecretRefEntry[];
  categories: Record<string, { displayName: string; description: string; order: number }>;
  metadata?: Metadata;
}

export interface SecretStatusEntry {
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

export interface FeaturesSource {
  version: string;
  flags: Record<string, boolean>;
  metadata?: Metadata;
}

export interface ReleaseInfo {
  id: string;
  timestamp: string;
  summary: string;
  files: string[];
  restartTriggered: boolean;
  previousReleaseId?: string;
}

export interface ReleaseMetadata {
  current: ReleaseInfo | null;
  history: ReleaseInfo[];
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

export interface DiffFileSummary {
  file: string;
  summary: string;
  changes: number;
}

export interface DiffResult {
  text: string;
  files: DiffFileSummary[];
}

export interface ApplyStatus {
  dirty: boolean;
  pendingFiles: number;
  pendingChanges: string[];
  lastApplied: string | null;
  validation: ValidationResult;
}

export interface DashboardData {
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

export interface CombinedSources {
  routing: RoutingSource;
  plugins: PluginsSource;
  providers: ProvidersSource;
  mcp: McpSource;
  oauth: OAuthSource;
  features: FeaturesSource;
  secretsRefs: SecretsRefsSource;
}

export interface RenderedConfigs {
  opencode: Record<string, unknown>;
  ohMySlim: string;
  ohMySlims: Record<string, string>;
}
