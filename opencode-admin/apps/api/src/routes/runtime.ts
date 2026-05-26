import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import type { FastifyPluginAsync } from 'fastify';
import { config } from '../services/config.js';
import * as files from '../services/files.js';

const execFileAsync = promisify(execFile);

type RuntimeTone = 'success' | 'warning' | 'error' | 'info';

type ContainerStatus = {
  name: string;
  present: boolean;
  running: boolean;
  state: string;
  health: string | null;
  image: string | null;
  error?: string;
};

type SiteStatus = {
  id: string;
  label: string;
  url: string;
  kind: 'web' | 'api' | 'ssh' | 'webdav';
  container: string;
  status: RuntimeTone;
  message: string;
};

type IcloudStatus = {
  remote: string;
  hostPath: string;
  adminMountPath: string;
  adminMountAccessible: boolean;
  adminMountEntries: string[];
  rcloneConfigPresent: boolean;
  container: ContainerStatus;
  fuseMountActive: boolean | null;
  status: RuntimeTone;
  message: string;
  commands: string[];
};

type TokenSpeedStatus = {
  configuredInAdmin: boolean;
  configuredInTarget: boolean;
  seededInImage: boolean;
  installedInBackend: boolean | null;
  sshUsesSharedBackend: boolean;
  status: RuntimeTone;
  message: string;
  commands: string[];
};

type RuntimeStatus = {
  targetStackPath: string;
  sites: SiteStatus[];
  containers: ContainerStatus[];
  icloud: IcloudStatus;
  tokenspeed: TokenSpeedStatus;
};

const sites = [
  { id: 'opencode', label: 'OpenCode terminal', url: 'https://opencode.2631.eu', kind: 'web' as const, container: 'opencode-dev' },
  { id: 'admin', label: 'OpenCode Admin', url: 'https://opencode.2631.eu/manage', kind: 'api' as const, container: 'opencode-admin' },
  { id: 'openchamber', label: 'OpenChamber', url: 'https://openchamber.2631.eu', kind: 'web' as const, container: 'openchamber' },
  { id: 'code-server', label: 'code-server', url: 'https://code.2631.eu', kind: 'web' as const, container: 'code-server' },
  { id: 'files-opencode', label: 'WebDAV via OpenCode', url: 'https://opencode.2631.eu/files', kind: 'webdav' as const, container: 'sftpgo' },
  { id: 'files-code', label: 'WebDAV via code.2631.eu', url: 'https://code.2631.eu/files', kind: 'webdav' as const, container: 'sftpgo' },
  { id: 'ntfy', label: 'ntfy notifications', url: 'https://notify.2631.eu', kind: 'web' as const, container: 'ntfy' },
  { id: 'ssh', label: 'SSH 2631DE', url: 'ssh 2631DE / port 2631', kind: 'ssh' as const, container: 'ssh-dev' },
];

function emptyContainer(name: string, error?: string): ContainerStatus {
  return { name, present: false, running: false, state: 'unknown', health: null, image: null, ...(error ? { error } : {}) };
}

async function readText(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readableStackPath(): Promise<string> {
  if (await pathExists(config.targetStackPath)) return config.targetStackPath;

  const repoGeneratedStack = path.resolve(config.projectRoot, '..', 'generated', '2631de', 'opencode-dev');
  if (await pathExists(repoGeneratedStack)) return repoGeneratedStack;

  return config.targetStackPath;
}

async function dockerInspect(name: string): Promise<ContainerStatus> {
  try {
    const { stdout } = await execFileAsync('docker', ['inspect', name], { timeout: 10_000, maxBuffer: 1024 * 1024 });
    const parsed = JSON.parse(stdout) as Array<{
      Config?: { Image?: string };
      State?: { Status?: string; Running?: boolean; Health?: { Status?: string } };
    }>;
    const container = parsed[0];
    return {
      name,
      present: true,
      running: Boolean(container?.State?.Running),
      state: container?.State?.Status ?? 'unknown',
      health: container?.State?.Health?.Status ?? null,
      image: container?.Config?.Image ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'docker inspect failed';
    return emptyContainer(name, message.includes('ENOENT') ? 'Docker CLI not available in this environment' : message);
  }
}

async function dockerExec(container: string, command: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('docker', ['exec', container, 'sh', '-lc', command], { timeout: 10_000, maxBuffer: 1024 * 1024 });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function readEnvValue(key: string): Promise<string | null> {
  const content = await readText(config.targetEnvPath);
  const match = content.split('\n').map((line) => line.trim()).find((line) => line.startsWith(`${key}=`));
  if (!match) return null;
  return match.slice(key.length + 1).replace(/^['"]|['"]$/g, '') || null;
}

function siteStatus(container: ContainerStatus): Pick<SiteStatus, 'status' | 'message'> {
  if (!container.present) return { status: 'warning', message: container.error ?? 'Containerstatus nog niet beschikbaar' };
  if (!container.running) return { status: 'error', message: `Container is ${container.state}` };
  if (container.health === 'unhealthy') return { status: 'error', message: 'Container is unhealthy' };
  if (container.health === 'starting') return { status: 'warning', message: 'Container start nog op' };
  return { status: 'success', message: container.health ? `Docker health: ${container.health}` : 'Container draait' };
}

async function listAdminIcloudEntries(adminMountPath: string): Promise<{ accessible: boolean; entries: string[] }> {
  try {
    const entries = await fs.readdir(adminMountPath, { withFileTypes: true });
    return {
      accessible: true,
      entries: entries.slice(0, 12).map((entry) => `${entry.isDirectory() ? '📁' : '📄'} ${entry.name}`),
    };
  } catch {
    return { accessible: false, entries: [] };
  }
}

async function buildIcloudStatus(container: ContainerStatus): Promise<IcloudStatus> {
  const hostPath = process.env.OPENCODE_ICLOUD_HOST_PATH || path.join(config.targetStackPath, 'icloud-drive');
  const adminMountPath = process.env.OPENCODE_ICLOUD_ADMIN_MOUNT_PATH || '/app/icloud';
  const remote = process.env.OPENCODE_ICLOUD_REMOTE || await readEnvValue('ICLOUD_RCLONE_REMOTE') || 'icloud:opencode-sync';
  const rcloneConfigPresent = await pathExists(path.join(config.targetStackPath, 'state', 'rclone', 'rclone.conf'));
  const { accessible, entries } = await listAdminIcloudEntries(adminMountPath);
  const mountCheck = await dockerExec(container.name, "grep -E ' /mnt/icloud (fuse|fuse\\.rclone|rclone) ' /proc/mounts");
  const fuseMountActive = container.present ? Boolean(mountCheck) : null;

  let status: RuntimeTone = 'success';
  let message = 'iCloud Drive / Opencode-Sync is gemount en zichtbaar in opencode-admin.';
  if (!rcloneConfigPresent) {
    status = 'warning';
    message = 'rclone iCloud config ontbreekt nog. Draai make icloud-config op 2631DE.';
  } else if (!container.running || container.health === 'unhealthy' || fuseMountActive === false) {
    status = 'error';
    message = 'icloud-rclone draait niet gezond of de FUSE mount is niet actief.';
  } else if (!accessible) {
    status = 'warning';
    message = 'iCloud mount lijkt actief, maar is nog niet in opencode-admin zichtbaar. Controleer admin compose mount.';
  }

  return {
    remote,
    hostPath,
    adminMountPath,
    adminMountAccessible: accessible,
    adminMountEntries: entries,
    rcloneConfigPresent,
    container,
    fuseMountActive,
    status,
    message,
    commands: ['make icloud-prepare', 'make icloud-config', 'make up-icloud', 'make icloud-status', 'make icloud-test', 'make icloud-logs'],
  };
}

async function buildTokenSpeedStatus(): Promise<TokenSpeedStatus> {
  const plugins = await files.listPlugins();
  const stackPath = await readableStackPath();
  const configuredInAdmin = plugins.some((plugin) => plugin.enabled && plugin.package.includes('opencode-tokenspeed-monitor'));
  const [targetConfig, targetTemplate, dockerfile, sshEntrypoint, sessionScript] = await Promise.all([
    readText(path.join(stackPath, 'config', 'opencode', 'opencode.json')),
    readText(path.join(stackPath, 'config', 'opencode', 'opencode.json.tmpl')),
    readText(path.join(stackPath, 'Dockerfile.opencode')),
    readText(path.join(stackPath, 'ssh-entrypoint.sh')),
    readText(path.join(stackPath, 'opencode-session.sh')),
  ]);
  const configuredInTarget = [targetConfig, targetTemplate].some((content) => content.includes('opencode-tokenspeed-monitor'));
  const seededInImage = dockerfile.includes('opencode-tokenspeed-monitor');
  const installedProbe = await dockerExec('opencode-backend', 'test -d /home/app/.cache/opencode-seed/node_modules/opencode-tokenspeed-monitor && printf yes || printf no');
  const installedInBackend = installedProbe === null ? null : installedProbe === 'yes';
  const sshUsesSharedBackend = sshEntrypoint.includes('tmux -S /shared/tmux.sock') && sessionScript.includes('opencode attach');

  let status: RuntimeTone = 'success';
  let message = 'TokenSpeed Monitor staat standaard aan en SSH 2631DE gebruikt dezelfde OpenCode runtime.';
  if (!configuredInAdmin || !configuredInTarget || !seededInImage) {
    status = 'error';
    message = 'TokenSpeed Monitor mist in admin config, target config of Docker image seed.';
  } else if (installedInBackend === false) {
    status = 'warning';
    message = 'Config is correct, maar de draaiende backend image lijkt de package nog niet te bevatten. Rebuild de stack.';
  } else if (installedInBackend === null) {
    status = 'info';
    message = 'Config en image seed zijn correct; runtime-install kon lokaal niet via Docker worden gecontroleerd.';
  } else if (!sshUsesSharedBackend) {
    status = 'warning';
    message = 'TokenSpeed staat aan, maar de SSH attach-flow wijkt af van de gedeelde backend-flow.';
  }

  return {
    configuredInAdmin,
    configuredInTarget,
    seededInImage,
    installedInBackend,
    sshUsesSharedBackend,
    status,
    message,
    commands: ['ts-status', 'ts-stats', 'ts-history', 'ts-toggle', 'ts-bg'],
  };
}

export const runtimeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    const containerNames = [...new Set([...sites.map((site) => site.container), 'icloud-rclone'])];
    const containers = await Promise.all(containerNames.map((name) => dockerInspect(name)));
    const byName = new Map(containers.map((container) => [container.name, container]));

    const siteData = sites.map((site) => {
      const container = byName.get(site.container) ?? emptyContainer(site.container);
      return { ...site, ...siteStatus(container) };
    });

    const icloudContainer = byName.get('icloud-rclone') ?? emptyContainer('icloud-rclone');
    const [icloud, tokenspeed] = await Promise.all([
      buildIcloudStatus(icloudContainer),
      buildTokenSpeedStatus(),
    ]);

    const data: RuntimeStatus = {
      targetStackPath: config.targetStackPath,
      sites: siteData,
      containers,
      icloud,
      tokenspeed,
    };

    return { success: true, data };
  });
};
