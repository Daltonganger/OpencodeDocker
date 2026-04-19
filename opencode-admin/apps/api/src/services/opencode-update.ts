import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const UPDATE_LOG_LIMIT = 120_000;
const OPENCODE_SOURCE_URL = 'https://github.com/anomalyco/opencode';

type RuntimeDetails = {
  version: string | null;
  upstreamRelease: string | null;
  source: string | null;
};

export type OpencodeUpdateStatus = {
  running: boolean;
  startedAt: string | null;
  completedAt: string | null;
  exitCode: number | null;
  success: boolean | null;
  message: string;
  log: string;
  runtime: RuntimeDetails;
};

let activeProcess: ReturnType<typeof spawn> | null = null;
let updateStatus: OpencodeUpdateStatus = {
  running: false,
  startedAt: null,
  completedAt: null,
  exitCode: null,
  success: null,
  message: 'No OpenCode runtime update has been started yet.',
  log: '',
  runtime: {
    version: null,
    upstreamRelease: null,
    source: OPENCODE_SOURCE_URL,
  },
};

function appendLog(chunk: string) {
  if (!chunk) return;
  updateStatus.log = `${updateStatus.log}${chunk}`.slice(-UPDATE_LOG_LIMIT);
}

async function readDockerOutput(args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('docker', args, { timeout: 15_000, maxBuffer: 1024 * 1024 });
    const trimmed = stdout.trim();
    return trimmed.length ? trimmed : null;
  } catch {
    return null;
  }
}

async function readUpdaterEnv(): Promise<Record<string, string>> {
  const envJson = await readDockerOutput(['inspect', 'opencode-auto-updater', '--format', '{{json .Config.Env}}']);
  if (!envJson) {
    return {};
  }

  try {
    const entries = JSON.parse(envJson) as string[];
    return Object.fromEntries(entries.map((entry) => {
      const index = entry.indexOf('=');
      return index === -1 ? [entry, ''] : [entry.slice(0, index), entry.slice(index + 1)];
    }));
  } catch {
    return {};
  }
}

async function readRuntimeDetails(): Promise<RuntimeDetails> {
  const [version, upstreamRelease, source] = await Promise.all([
    readDockerOutput(['exec', 'opencode-backend', 'sh', '-lc', 'opencode --version']),
    readDockerOutput(['exec', 'opencode-backend', 'sh', '-lc', 'cat /home/app/.local/share/opencode/upstream-release.txt']),
    readDockerOutput(['exec', 'opencode-backend', 'sh', '-lc', 'cat /home/app/.local/share/opencode/upstream-source.txt']),
  ]);

  return {
    version,
    upstreamRelease,
    source: source ?? OPENCODE_SOURCE_URL,
  };
}

async function assertUpdaterConfigured(): Promise<void> {
  const env = await readUpdaterEnv();
  if (!env.OPENCODE_UPDATER_REPO_URL) {
    throw new Error('OPENCODE_UPDATER_REPO_URL is not configured on opencode-auto-updater.');
  }
}

function startUpdateProcess() {
  activeProcess = spawn('docker', [
    'exec',
    '-e', 'OPENCODE_UPDATER_FORCE=true',
    '-e', 'OPENCODE_UPDATER_SCOPE=stack',
    'opencode-auto-updater',
    'bash', '/updater/update-once.sh',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeProcess.stdout?.on('data', (chunk) => appendLog(chunk.toString()));
  activeProcess.stderr?.on('data', (chunk) => appendLog(chunk.toString()));

  activeProcess.on('error', async (error) => {
    appendLog(`${error.message}\n`);
    updateStatus = {
      ...updateStatus,
      running: false,
      completedAt: new Date().toISOString(),
      exitCode: 1,
      success: false,
      message: `OpenCode update failed to start: ${error.message}`,
      runtime: await readRuntimeDetails(),
    };
    activeProcess = null;
  });

  activeProcess.on('close', async (code) => {
    const exitCode = typeof code === 'number' ? code : 1;
    updateStatus = {
      ...updateStatus,
      running: false,
      completedAt: new Date().toISOString(),
      exitCode,
      success: exitCode === 0,
      message: exitCode === 0
        ? 'OpenCode runtime updated successfully.'
        : `OpenCode runtime update failed with exit code ${exitCode}.`,
      runtime: await readRuntimeDetails(),
    };
    activeProcess = null;
  });
}

export async function getOpencodeUpdateStatus(): Promise<OpencodeUpdateStatus> {
  updateStatus = {
    ...updateStatus,
    runtime: await readRuntimeDetails(),
  };
  return updateStatus;
}

export async function triggerOpencodeUpdate(): Promise<OpencodeUpdateStatus> {
  if (activeProcess && updateStatus.running) {
    return getOpencodeUpdateStatus();
  }

  await assertUpdaterConfigured();

  updateStatus = {
    running: true,
    startedAt: new Date().toISOString(),
    completedAt: null,
    exitCode: null,
    success: null,
    message: 'Updating OpenCode runtime from the latest anomalyco/opencode release…',
    log: '',
    runtime: await readRuntimeDetails(),
  };

  startUpdateProcess();
  return updateStatus;
}
