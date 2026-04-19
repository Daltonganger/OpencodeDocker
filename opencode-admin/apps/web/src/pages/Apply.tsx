import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyChanges, getApplyStatus, getDiff, getOpencodeUpdateStatus, getReleases, rollbackLast, triggerOpencodeUpdate, validateChanges } from '@/api';
import type { ApplyStatus, OpencodeUpdateStatus, ReleaseInfo, ValidationResult } from '@/types';

type FlashMessage = {
  text: string;
  tone: 'success' | 'warning' | 'error' | 'info';
};

export function Apply() {
  const [status, setStatus] = useState<ApplyStatus | null>(null);
  const [diffText, setDiffText] = useState('');
  const [releases, setReleases] = useState<{ current: ReleaseInfo | null; history: ReleaseInfo[] }>({ current: null, history: [] });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [opencodeUpdate, setOpencodeUpdate] = useState<OpencodeUpdateStatus | null>(null);
  const [message, setMessage] = useState<FlashMessage | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const [showAllPending, setShowAllPending] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [isStartingUpdate, setIsStartingUpdate] = useState(false);

  const load = useCallback(async () => {
    const [statusRes, diffRes, releasesRes, updateRes] = await Promise.all([getApplyStatus(), getDiff(), getReleases(), getOpencodeUpdateStatus()]);
    setStatus(statusRes.data);
    setDiffText(diffRes.data);
    setReleases(releasesRes.data);
    setOpencodeUpdate(updateRes.data);
    setValidation(statusRes.data.validation);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!opencodeUpdate?.running) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void getOpencodeUpdateStatus()
        .then((response) => setOpencodeUpdate(response.data))
        .catch(() => undefined)
    }, 4000)

    return () => window.clearInterval(timer)
  }, [opencodeUpdate?.running])

  const activeValidation = validation ?? status?.validation ?? { valid: true, errors: [], warnings: [] };
  const diffSummary = useMemo(() => summarizeDiff(diffText), [diffText]);
  const hasIssues = activeValidation.errors.length > 0 || activeValidation.warnings.length > 0;
  const visiblePendingChanges = showAllPending ? status?.pendingChanges ?? [] : status?.pendingChanges.slice(0, 6) ?? [];

  if (!status) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const handleValidate = async () => {
    try {
      setIsValidating(true);
      const response = await validateChanges();
      setValidation(response.data);
      setMessage({
        text: response.data.valid
          ? response.data.warnings.length
            ? `Pre-flight check passed with ${response.data.warnings.length} warning${response.data.warnings.length === 1 ? '' : 's'}.`
            : 'Pre-flight check passed.'
          : `Pre-flight check failed with ${response.data.errors.length} blocking issue${response.data.errors.length === 1 ? '' : 's'}.`,
        tone: response.data.valid ? (response.data.warnings.length ? 'warning' : 'success') : 'error',
      });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Validation failed', tone: 'error' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleApply = async () => {
    try {
      setIsApplying(true);
      const response = await applyChanges();
      const warningText = response.data.warnings.length ? ` Warnings: ${response.data.warnings.join(' | ')}` : '';
      setMessage({
        text: `Applied release ${response.data.releaseId}.${response.data.restartTriggered ? ' Restart succeeded.' : ' Restart not triggered or failed.'}${warningText}`,
        tone: response.data.warnings.length ? 'warning' : 'success',
      });
      setValidation(response.data.validation);
      await load();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Apply failed', tone: 'error' });
    } finally {
      setIsApplying(false);
    }
  };

  const handleRollback = async () => {
    try {
      setIsRollingBack(true);
      const response = await rollbackLast();
      setMessage({ text: `Rolled back to ${response.data.toReleaseId}`, tone: 'warning' });
      await load();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Rollback failed', tone: 'error' });
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleOpencodeUpdate = async () => {
    try {
      setIsStartingUpdate(true)
      const response = await triggerOpencodeUpdate()
      setOpencodeUpdate(response.data)
      setMessage({ text: 'OpenCode update gestart. Dit kan enkele minuten duren.', tone: 'info' })
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'OpenCode update starten mislukte', tone: 'error' })
    } finally {
      setIsStartingUpdate(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Apply</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Validate, diff, apply and rollback the generated OpenCode runtime config.</p>
      </div>

      {message && <div className={`message-banner message-${message.tone}`} style={{ marginBottom: 16 }}>{message.text}</div>}

      <div className="sticky-action-bar" style={{ marginBottom: 20 }}>
        <div className="action-context">
          <span className={`badge ${status.dirty ? 'badge-warning' : 'badge-success'}`}>{status.dirty ? 'Pending changes' : 'Clean'}</span>
          {activeValidation.errors.length > 0 ? (
            <span className="badge badge-error">{activeValidation.errors.length} blocking</span>
          ) : activeValidation.warnings.length > 0 ? (
            <span className="badge badge-warning">{activeValidation.warnings.length} warnings</span>
          ) : (
            <span className="badge badge-success">Pre-flight OK</span>
          )}
          <span className="muted-text">Last applied {status.lastApplied ? new Date(status.lastApplied).toLocaleString() : 'never'}</span>
        </div>
        <div className="action-group">
          <button type="button" className="btn btn-secondary" onClick={() => void handleValidate()} disabled={isValidating}>{isValidating ? 'Checking…' : 'Validate'}</button>
          <button type="button" className="btn btn-primary" onClick={() => void handleApply()} disabled={!status.dirty || isApplying}>{isApplying ? 'Applying…' : 'Apply & restart'}</button>
          <button type="button" className="btn btn-danger" onClick={() => void handleRollback()} disabled={!releases.history.length || isRollingBack}>{isRollingBack ? 'Reverting…' : 'Revert previous'}</button>
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <Stat label="Pending files" value={status.pendingFiles.toString()} />
        <Stat label="Blocking issues" value={activeValidation.errors.length.toString()} tone={activeValidation.errors.length ? 'error' : 'success'} />
        <Stat label="Warnings" value={activeValidation.warnings.length.toString()} tone={activeValidation.warnings.length ? 'warning' : 'success'} />
        <Stat label="Last applied" value={status.lastApplied ? new Date(status.lastApplied).toLocaleString() : 'never'} />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">OpenCode runtime</h3>
            <div className="section-description">Rebuild de stack met de nieuwste release van anomalyco/opencode.</div>
          </div>
          <div className="action-group">
            <button type="button" className="btn btn-primary" onClick={() => void handleOpencodeUpdate()} disabled={Boolean(opencodeUpdate?.running) || isStartingUpdate}>
              {opencodeUpdate?.running ? 'Updating…' : isStartingUpdate ? 'Starting…' : 'Update OpenCode'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void load()}>Refresh</button>
          </div>
        </div>

        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <Stat label="Current version" value={opencodeUpdate?.runtime.version ?? 'unknown'} />
          <Stat label="Upstream release" value={opencodeUpdate?.runtime.upstreamRelease ?? 'unknown'} />
          <Stat label="Last result" value={formatUpdateResult(opencodeUpdate)} tone={opencodeUpdate?.success === false ? 'error' : opencodeUpdate?.success ? 'success' : opencodeUpdate?.running ? 'warning' : undefined} />
          <Stat label="Last finished" value={opencodeUpdate?.completedAt ? new Date(opencodeUpdate.completedAt).toLocaleString() : 'never'} />
        </div>

        <div className="section-description" style={{ marginBottom: 12 }}>
          Source: <span style={{ fontFamily: 'var(--font-mono)' }}>{opencodeUpdate?.runtime.source ?? 'https://github.com/anomalyco/opencode'}</span>
        </div>
        <div className={`message-banner message-${opencodeUpdate?.success === false ? 'error' : opencodeUpdate?.running ? 'warning' : opencodeUpdate?.success ? 'success' : 'info'}`} style={{ marginBottom: 12 }}>
          {opencodeUpdate?.message ?? 'No OpenCode runtime update has been started yet.'}
        </div>

        <details className="card card-collapsible">
          <summary className="card-header collapsible-summary">
            <div>
              <h3 className="card-title">Updater log</h3>
              <div className="section-description">Laatste output van de handmatige OpenCode update.</div>
            </div>
            <span className="badge badge-info">{(opencodeUpdate?.log ?? '').trim() ? 'available' : 'empty'}</span>
          </summary>
          <pre className="diff-preview">{(opencodeUpdate?.log ?? '').trim() || 'Nog geen updater-output beschikbaar.'}</pre>
        </details>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Staged files</h3>
            <div className="section-description">Only the files that will change are shown here.</div>
          </div>
          {status.pendingChanges.length > 0 && <span className="badge badge-info">{status.pendingChanges.length} files</span>}
        </div>
        {status.pendingChanges.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No changes to apply.</p> : (
          <>
            <div className="compact-list">
              {visiblePendingChanges.map((item) => <div key={item} className="compact-list-item">{item}</div>)}
            </div>
            {status.pendingChanges.length > 6 && (
              <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setShowAllPending((current) => !current)}>
                {showAllPending ? 'Show less' : `Show all ${status.pendingChanges.length} files`}
              </button>
            )}
          </>
        )}
      </div>

      {hasIssues && (
        <div className={`card issue-card ${activeValidation.errors.length ? 'issue-card-error' : 'issue-card-warning'}`} style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Needs attention</h3>
              <div className="section-description">You only need to look here when something blocks or needs review.</div>
            </div>
            <div className="action-context">
              {activeValidation.errors.length > 0 && <span className="badge badge-error">{activeValidation.errors.length} errors</span>}
              {activeValidation.warnings.length > 0 && <span className="badge badge-warning">{activeValidation.warnings.length} warnings</span>}
            </div>
          </div>

          {activeValidation.errors.length > 0 && <IssueList title="Blocking errors" issues={activeValidation.errors} tone="error" />}

          {activeValidation.warnings.length > 0 && (
            <div style={{ marginTop: activeValidation.errors.length ? 16 : 0 }}>
              <div className="action-group" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="section-description">Warnings are hidden by default unless you want to inspect them.</div>
                <button type="button" className="btn btn-secondary" onClick={() => setShowWarnings((current) => !current)}>
                  {showWarnings ? 'Hide warnings' : `Show ${activeValidation.warnings.length} warnings`}
                </button>
              </div>
              {showWarnings && <IssueList title="Warnings" issues={activeValidation.warnings} tone="warning" />}
            </div>
          )}
        </div>
      )}

      <details className="card card-collapsible" style={{ marginBottom: 20 }}>
        <summary className="card-header collapsible-summary">
          <div>
            <h3 className="card-title">View changes</h3>
            <div className="section-description">{diffSummary.summary}</div>
          </div>
          <div className="action-context">
            <span className="badge badge-info">{diffSummary.files} files</span>
            <span className="badge badge-success">+{diffSummary.added}</span>
            <span className="badge badge-error">-{diffSummary.removed}</span>
          </div>
        </summary>
        <pre className="diff-preview">{diffText || 'No diff available.'}</pre>
      </details>

      <details className="card card-collapsible">
        <summary className="card-header collapsible-summary">
          <div>
            <h3 className="card-title">Release history</h3>
            <div className="section-description">Current release first, previous releases collapsed until needed.</div>
          </div>
          <span className="badge badge-info">{(releases.current ? 1 : 0) + releases.history.length} releases</span>
        </summary>
        <div style={{ display: 'grid', gap: 8 }}>
          {releases.current && <ReleaseRow label="Current" release={releases.current} />}
          {releases.history.map((release) => <ReleaseRow key={release.id} label="Previous" release={release} />)}
        </div>
      </details>
    </div>
  );
}

function formatUpdateResult(status: OpencodeUpdateStatus | null) {
  if (!status) return 'unknown'
  if (status.running) return 'running'
  if (status.success === true) return 'success'
  if (status.success === false) return `failed (${status.exitCode ?? 'n/a'})`
  return 'idle'
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'error' | 'warning' | 'success' }) {
  return <div className="stat-card"><div className="stat-label">{label}</div><div className="stat-value" style={{ fontSize: 18, color: tone === 'error' ? 'var(--accent-error)' : tone === 'warning' ? 'var(--accent-warning)' : tone === 'success' ? 'var(--accent-success)' : undefined }}>{value}</div></div>;
}

function IssueList({ title, issues, tone }: { title: string; issues: ValidationResult['errors']; tone: 'error' | 'warning' }) {
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>{title}</div>
      <div className="issue-list">
        {issues.map((issue) => (
          <div key={`${issue.path}-${issue.message}`} className={`issue-row issue-row-${tone}`}>
            <div style={{ fontWeight: 600 }}>{issue.path}</div>
            <div className="section-description" style={{ marginTop: 2 }}>{issue.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReleaseRow({ label, release }: { label: string; release: ReleaseInfo }) {
  return (
    <div style={{ padding: 12, border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ fontWeight: 600 }}>{label}: {release.id}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{new Date(release.timestamp).toLocaleString()} • {release.summary}</div>
    </div>
  );
}

function summarizeDiff(diffText: string) {
  if (!diffText.trim()) {
    return { files: 0, added: 0, removed: 0, summary: 'No diff available.' };
  }

  const lines = diffText.split('\n');
  let files = 0;
  let added = 0;
  let removed = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git')) files += 1;
    if (line.startsWith('+') && !line.startsWith('+++')) added += 1;
    if (line.startsWith('-') && !line.startsWith('---')) removed += 1;
  }

  if (!files) {
    files = new Set(lines.filter((line) => line.trim().startsWith('config/') || line.trim().startsWith('/')).map((line) => line.trim())).size;
  }

  return {
    files,
    added,
    removed,
    summary: files
      ? `${files} file${files === 1 ? '' : 's'} changed • +${added} / -${removed}`
      : `${lines.filter(Boolean).length} lines in diff preview`,
  };
}
