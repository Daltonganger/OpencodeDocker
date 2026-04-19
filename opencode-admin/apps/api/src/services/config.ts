import path from 'path';

const cwd = process.cwd();
const projectRoot = path.basename(cwd) === 'api' ? path.resolve(cwd, '../..') : cwd;

export const config = {
  projectRoot,
  sourcesDir: process.env.OPENCODE_SOURCES_DIR || path.join(projectRoot, 'config', 'sources'),
  generatedDir: process.env.OPENCODE_GENERATED_DIR || path.join(projectRoot, 'config', 'generated'),
  targetStackPath: process.env.OPENCODE_TARGET_STACK_PATH || process.env.OPENCODE_STACK_PATH || '/opt/stacks/opencode-dev',
  targetEnvPath: process.env.OPENCODE_TARGET_ENV_PATH || path.join(process.env.OPENCODE_TARGET_STACK_PATH || process.env.OPENCODE_STACK_PATH || '/opt/stacks/opencode-dev', '.env'),
  applyRestartEnabled: process.env.OPENCODE_APPLY_RESTART === 'true',
  applyRestartServices: (process.env.OPENCODE_APPLY_RESTART_SERVICES || 'opencode-backend opencode-dev openchamber')
    .split(/[\s,]+/)
    .map((service) => service.trim())
    .filter(Boolean),
  appBaseUrl: process.env.OPENCODE_ADMIN_BASE_URL || 'https://manage-opencode.2631.eu',
  get routingSourcePath() {
    return path.join(this.sourcesDir, 'routing.json');
  },
  get pluginsSourcePath() {
    return path.join(this.sourcesDir, 'plugins.json');
  },
  get providersSourcePath() {
    return path.join(this.sourcesDir, 'providers.json');
  },
  get mcpSourcePath() {
    return path.join(this.sourcesDir, 'mcp.json');
  },
  get oauthSourcePath() {
    return path.join(this.sourcesDir, 'oauth.json');
  },
  get featuresSourcePath() {
    return path.join(this.sourcesDir, 'features.json');
  },
  get secretsRefsSourcePath() {
    return path.join(this.sourcesDir, 'secrets.refs.json');
  },
  get openCodeJsonPath() {
    return path.join(this.generatedDir, 'opencode.json');
  },
  get ohMyOpenCodeSlimPath() {
    return path.join(this.generatedDir, 'oh-my-opencode-slim.jsonc');
  },
  get releaseMetadataPath() {
    return path.join(this.generatedDir, 'release-metadata.json');
  },
  get releasesDir() {
    return path.join(this.generatedDir, 'releases');
  },
  get targetOpenCodeJsonPath() {
    return path.join(this.targetStackPath, 'config', 'opencode', 'opencode.json');
  },
  get targetOpenCodeTemplatePath() {
    return path.join(this.targetStackPath, 'config', 'opencode', 'opencode.json.tmpl');
  },
  get targetOpenCodeConfigDir() {
    return path.join(this.targetStackPath, 'config', 'opencode');
  },
  get targetAntigravityAccountsPath() {
    return path.join(this.targetOpenCodeConfigDir, 'antigravity-accounts.json');
  },
  get targetAuthJsonPath() {
    return path.join(this.targetStackPath, 'state', 'opencode', 'share', 'auth.json');
  },
  get targetOhMySlimPath() {
    return path.join(this.targetStackPath, 'config', 'opencode', 'oh-my-opencode-slim.jsonc');
  },
  get targetOhMySlimTemplatePath() {
    return path.join(this.targetStackPath, 'config', 'opencode', 'oh-my-opencode-slim.jsonc.tmpl');
  },
  get targetComposePath() {
    return path.join(this.targetStackPath, 'compose.yaml');
  },
  get ohMyOpenCodeSlimDir() {
    return this.generatedDir;
  },
};
