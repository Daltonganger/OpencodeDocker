import { execFile } from 'child_process';
import { promisify } from 'util';
import * as files from '../services/files.js';
import { config } from '../services/config.js';
import { renderConfigs, makeReleaseId } from '../services/renderer.js';
import { validateSources } from '../services/validation.js';
import type { ApplyStatus, CombinedSources, DiffResult, ReleaseInfo } from '../types/index.js';

const execFileAsync = promisify(execFile);

async function restartTargetServices(): Promise<void> {
  const composeFile = config.targetComposePath;
  const services = config.applyRestartServices;
  const shellCommand = [
    'if docker compose version >/dev/null 2>&1; then',
    `  docker compose -f '${composeFile}' restart ${services.join(' ')};`,
    'elif command -v docker-compose >/dev/null 2>&1; then',
    `  docker-compose -f '${composeFile}' restart ${services.join(' ')};`,
    'else',
    "  echo 'Neither docker compose nor docker-compose is available' >&2;",
    '  exit 127;',
    'fi',
  ].join(' ');

  await execFileAsync('sh', ['-lc', shellCommand]);
}

export async function loadSources(): Promise<CombinedSources> {
  return files.getCombinedSources();
}

export async function buildValidation() {
  const [sources, envEntries] = await Promise.all([loadSources(), files.readEnvFile()]);
  return validateSources(sources, envEntries);
}

export async function buildRendered() {
  return renderConfigs(await loadSources());
}

export async function buildDiffResult(): Promise<DiffResult> {
  const rendered = await buildRendered();
  const presetEntries = Object.entries(rendered.ohMySlims ?? {});
  const [currentOpenCode, currentSlim, currentPresetSlims] = await Promise.all([
    files.readCurrentTargetOpenCodeText(),
    files.readCurrentTargetSlimText(),
    Promise.all(
      presetEntries.map(async ([presetId, content]) => ({
        presetId,
        content,
        before: await files.readCurrentTargetSlimPresetText(presetId),
      })),
    ),
  ]);
  const nextOpenCode = JSON.stringify(rendered.opencode, null, 2) + '\n';

  const fileComparisons = [
    { file: 'opencode.json', before: currentOpenCode ?? '', after: nextOpenCode },
    { file: 'oh-my-opencode-slim.jsonc', before: currentSlim ?? '', after: rendered.ohMySlim },
    ...currentPresetSlims.map(({ presetId, before, content }) => ({
      file: `oh-my-opencode-slim.${presetId}.jsonc`,
      before: before ?? '',
      after: content,
    })),
  ];

  const fileSummaries = fileComparisons.map((file) => {
    const beforeLines = file.before.split('\n');
    const afterLines = file.after.split('\n');
    const changes = Math.abs(beforeLines.length - afterLines.length) + afterLines.filter((line, index) => line !== beforeLines[index]).length;
    return {
      file: file.file,
      summary: changes === 0 ? 'No changes' : `${changes} changed line(s)`,
      changes,
      before: file.before,
      after: file.after,
    };
  });

  const text = fileSummaries
    .map((file) => `## ${file.file}\n${file.summary}\n\n--- current ---\n${file.before || '[empty]'}\n--- next ---\n${file.after || '[empty]'}`)
    .join('\n\n');

  return {
    text,
    files: fileSummaries.map(({ file, summary, changes }) => ({ file, summary, changes })),
  };
}

export async function buildApplyStatus(): Promise<ApplyStatus> {
  const validation = await buildValidation();
  const diff = await buildDiffResult();
  const releaseMetadata = await files.getReleaseMetadata();
  return {
    dirty: diff.files.some((file) => file.changes > 0),
    pendingFiles: diff.files.filter((file) => file.changes > 0).length,
    pendingChanges: diff.files.filter((file) => file.changes > 0).map((file) => `${file.file}: ${file.summary}`),
    lastApplied: releaseMetadata.current?.timestamp ?? null,
    validation,
  };
}

export async function runApply(): Promise<{ release: ReleaseInfo; filesWritten: string[]; validation: Awaited<ReturnType<typeof buildValidation>>; warnings: string[] }> {
  const validation = await buildValidation();
  if (!validation.valid) {
    throw Object.assign(new Error('Validation failed'), { validation });
  }

  const warnings: string[] = [];

  const rendered = await buildRendered();
  const releaseId = makeReleaseId();
  const releaseMetadata = await files.getReleaseMetadata();

  if (releaseMetadata.current && !(await files.releaseExists(releaseMetadata.current.id))) {
    await files.captureCurrentIntoRelease(releaseMetadata.current.id, 'Captured pre-admin snapshot');
  }

  const presetFileNames = Object.keys(rendered.ohMySlims ?? {}).map((k) => `oh-my-opencode-slim.${k}.jsonc`);
  const releaseFiles = ['opencode.json', 'oh-my-opencode-slim.jsonc', ...presetFileNames];

  const release = files.makeReleaseInfo({
    id: releaseId,
    summary: 'Applied via opencode-admin',
    files: releaseFiles,
    restartTriggered: config.applyRestartEnabled,
    previousReleaseId: releaseMetadata.current?.id,
  });

  await files.writeReleaseSnapshot(release, { openCode: rendered.opencode, ohMySlim: rendered.ohMySlim, ohMySlims: rendered.ohMySlims });
  const writeResult = await files.writeRenderedFiles({ openCode: rendered.opencode, ohMySlim: rendered.ohMySlim, ohMySlims: rendered.ohMySlims });

  if (process.env.NODE_ENV === 'production' && !writeResult.targetWritten) {
    throw new Error('Target stack paths are not writable; rendered files were not synced to the managed stack');
  }

  if (releaseMetadata.current) {
    releaseMetadata.history.unshift(releaseMetadata.current);
  }
  releaseMetadata.current = release;
  releaseMetadata.history = releaseMetadata.history.slice(0, 20);

  if (config.applyRestartEnabled) {
    try {
      await restartTargetServices();
      release.restartTriggered = true;
    } catch (error) {
      release.restartTriggered = false;
      warnings.push(error instanceof Error ? `Restart failed: ${error.message}` : 'Restart failed');
    }
  }

  releaseMetadata.current = release;
  await files.saveReleaseMetadata(releaseMetadata);

  return { release, filesWritten: writeResult.paths, validation, warnings };
}
