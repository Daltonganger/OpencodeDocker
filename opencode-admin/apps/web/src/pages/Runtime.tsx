import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRuntimeStatus } from '@/api';
import type { RuntimeContainerStatus, RuntimeSiteStatus, RuntimeStatus, RuntimeTone } from '@/types';

const toneBadge: Record<RuntimeTone, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  info: 'badge-info',
};

export function Runtime() {
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getRuntimeStatus();
      setRuntime(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Runtime status laden mislukt');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const healthySites = useMemo(() => runtime?.sites.filter((site) => site.status === 'success').length ?? 0, [runtime]);

  if (loading && !runtime) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (error) {
    return <div className="empty-state"><div className="empty-state-icon">⚠️</div><p>{error}</p></div>;
  }

  if (!runtime) {
    return <div className="empty-state"><div className="empty-state-icon">🛰️</div><p>Geen runtime status beschikbaar.</p></div>;
  }

  return (
    <div>
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Sites & Runtime</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            Controle over 2631DE websites, iCloud Drive / Opencode-Sync en TokenSpeed Monitor.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <Stat label="Websites" value={`${healthySites}/${runtime.sites.length}`} subtext="healthy containers" tone={healthySites === runtime.sites.length ? 'success' : 'warning'} />
        <Stat label="iCloud" value={statusLabel(runtime.icloud.status)} subtext={runtime.icloud.remote} tone={runtime.icloud.status} />
        <Stat label="TokenSpeed" value={statusLabel(runtime.tokenspeed.status)} subtext="SSH 2631DE shared backend" tone={runtime.tokenspeed.status} />
        <Stat label="Target stack" value="2631DE" subtext={runtime.targetStackPath} tone="info" />
      </div>

      <div className={`message-banner message-${runtime.icloud.status}`} style={{ marginBottom: 16 }}>{runtime.icloud.message}</div>
      <div className={`message-banner message-${runtime.tokenspeed.status}`} style={{ marginBottom: 20 }}>{runtime.tokenspeed.message}</div>

      <Section title="Alle websites" subtitle="Status wordt uit Docker container/health state gelezen; externe TLS/Authelia checks blijven op de server zelf.">
        <div className="grid grid-2">
          {runtime.sites.map((site) => <SiteCard key={site.id} site={site} />)}
        </div>
      </Section>

      <Section title="iPad werkplek" subtitle="Snelkoppelingen en checks om vanaf iPad altijd bij tmux, OpenChamber en bestanden te kunnen.">
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Aanbevolen webclips</h3>
                <div className="section-description">Zet deze in Safari op het beginscherm</div>
              </div>
              <Badge tone="info">iPad</Badge>
            </div>
            <div className="compact-list">
              <LinkItem label="OpenCode Tmux" href="https://opencode.2631.eu" description="ttyd → gedeelde tmux sessie" />
              <LinkItem label="OpenChamber" href="https://openchamber.2631.eu" description="rijke OpenCode web/app interface" />
              <LinkItem label="code-server" href="https://code.2631.eu" description="browser editor voor config en workspace" />
              <LinkItem label="Admin" href="https://opencode.2631.eu/manage" description="plugins, providers en runtime status" />
              <LinkItem label="Files" href="https://opencode.2631.eu/files" description="WebDAV/SFTPGo workspace" />
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Native apps</h3>
                <div className="section-description">Voor Blink Shell, Termius, Prompt of WebDAV apps</div>
              </div>
            </div>
            <p className="muted-text" style={{ marginBottom: 12 }}>
              SSH attach direct op dezelfde tmux sessie als de webterminal. WebDAV deelt dezelfde workspace en iCloud/Opencode-Sync map.
            </p>
            <CommandList commands={['ssh -p 2631 root@2631DE', 'WebDAV: https://opencode.2631.eu/files', 'Docs: docs/IPAD_WERKPLEK.md']} />
          </div>
        </div>
      </Section>

      <Section title="iCloud Drive / Opencode-Sync" subtitle="Dezelfde rclone FUSE mount is nu ook zichtbaar voor opencode-admin.">
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Mount status</h3>
                <div className="section-description">Remote en bind-mount paden</div>
              </div>
              <Badge tone={runtime.icloud.status}>{statusLabel(runtime.icloud.status)}</Badge>
            </div>
            <Detail label="Remote" value={runtime.icloud.remote} mono />
            <Detail label="Host path" value={runtime.icloud.hostPath} mono />
            <Detail label="Admin path" value={runtime.icloud.adminMountPath} mono />
            <Detail label="rclone config" value={runtime.icloud.rcloneConfigPresent ? 'present' : 'missing'} tone={runtime.icloud.rcloneConfigPresent ? 'success' : 'warning'} />
            <Detail label="FUSE mount" value={formatNullableBoolean(runtime.icloud.fuseMountActive)} tone={runtime.icloud.fuseMountActive ? 'success' : runtime.icloud.fuseMountActive === false ? 'error' : 'info'} />
            <Detail label="Admin access" value={runtime.icloud.adminMountAccessible ? 'visible' : 'not visible'} tone={runtime.icloud.adminMountAccessible ? 'success' : 'warning'} />
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Opencode-Sync preview</h3>
                <div className="section-description">Eerste items uit de admin mount</div>
              </div>
              <Badge tone={runtime.icloud.adminMountAccessible ? 'success' : 'warning'}>{runtime.icloud.adminMountAccessible ? 'mounted' : 'empty'}</Badge>
            </div>
            {runtime.icloud.adminMountEntries.length ? (
              <div className="compact-list">{runtime.icloud.adminMountEntries.map((entry) => <div className="compact-list-item" key={entry}>{entry}</div>)}</div>
            ) : (
              <p className="muted-text">Nog geen items zichtbaar. Start met <code>make up-icloud</code> op 2631DE.</p>
            )}
            <CommandList commands={runtime.icloud.commands} />
          </div>
        </div>
      </Section>

      <Section title="TokenSpeed Monitor" subtitle="Controle of de plugin standaard in admin, target config, image seed en SSH-flow zit.">
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Installatiechecks</h3>
                <div className="section-description">Statische config + runtime probe</div>
              </div>
              <Badge tone={runtime.tokenspeed.status}>{statusLabel(runtime.tokenspeed.status)}</Badge>
            </div>
            <Check label="Admin plugins source" value={runtime.tokenspeed.configuredInAdmin} />
            <Check label="Target opencode.json(.tmpl)" value={runtime.tokenspeed.configuredInTarget} />
            <Check label="Docker image seed" value={runtime.tokenspeed.seededInImage} />
            <Check label="Draaiende backend package" value={runtime.tokenspeed.installedInBackend} />
            <Check label="SSH deelt backend/tmux" value={runtime.tokenspeed.sshUsesSharedBackend} />
          </div>
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Gebruik in SSH 2631DE</h3>
                <div className="section-description">Deze commando's werken in dezelfde OpenCode sessie als ttyd.</div>
              </div>
            </div>
            <p className="muted-text" style={{ marginBottom: 12 }}>
              Omdat SSH force-attacht op de gedeelde tmux/OpenCode sessie, gebruikt SSH dezelfde plugin-runtime als de webterminal.
            </p>
            <CommandList commands={runtime.tokenspeed.commands} />
          </div>
        </div>
      </Section>

      <Section title="Containers" subtitle="Ruwe Docker status voor de services achter de sites.">
        <div className="table-container card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Container</th><th>Status</th><th>Health</th><th>Image</th></tr></thead>
            <tbody>{runtime.containers.map((container) => <ContainerRow key={container.name} container={container} />)}</tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="page-section-header">
        <div>
          <h3 className="page-section-title">{title}</h3>
          <p className="page-section-subtitle">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SiteCard({ site }: { site: RuntimeSiteStatus }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">{site.label}</h3>
          <div className="section-description">{site.url}</div>
        </div>
        <Badge tone={site.status}>{site.status}</Badge>
      </div>
      <Detail label="Container" value={site.container} mono />
      <Detail label="Type" value={site.kind} />
      <Detail label="Status" value={site.message} tone={site.status} />
    </div>
  );
}

function LinkItem({ label, href, description }: { label: string; href: string; description: string }) {
  return (
    <a className="compact-list-item" href={href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
      <strong>{label}</strong>
      <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{description}</span>
    </a>
  );
}

function ContainerRow({ container }: { container: RuntimeContainerStatus }) {
  const tone: RuntimeTone = !container.present ? 'warning' : container.running ? 'success' : 'error';
  return (
    <tr>
      <td style={{ fontFamily: 'SF Mono, Menlo, monospace' }}>{container.name}</td>
      <td><Badge tone={tone}>{container.present ? container.state : 'missing'}</Badge></td>
      <td>{container.health ?? 'n/a'}</td>
      <td style={{ color: 'var(--text-secondary)' }}>{container.image ?? container.error ?? 'unknown'}</td>
    </tr>
  );
}

function Stat({ label, value, subtext, tone }: { label: string; value: string; subtext: string; tone: RuntimeTone }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: 22 }}>{value}</div>
      <div className={`stat-change ${tone === 'success' ? 'positive' : tone === 'error' ? 'negative' : ''}`}>{subtext}</div>
    </div>
  );
}

function Badge({ tone, children }: { tone: RuntimeTone; children: React.ReactNode }) {
  return <span className={`badge ${toneBadge[tone]}`}>{children}</span>;
}

function Detail({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: RuntimeTone }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border-primary)' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'SF Mono, Menlo, monospace' : undefined, color: tone ? `var(--accent-${tone === 'error' ? 'error' : tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'info'})` : undefined }}>{value}</span>
    </div>
  );
}

function Check({ label, value }: { label: string; value: boolean | null }) {
  const tone: RuntimeTone = value === true ? 'success' : value === false ? 'error' : 'info';
  return <Detail label={label} value={value === null ? 'not checked' : value ? 'yes' : 'no'} tone={tone} />;
}

function CommandList({ commands }: { commands: string[] }) {
  return (
    <div className="compact-list" style={{ marginTop: 14 }}>
      {commands.map((command) => <code className="compact-list-item" key={command}>{command}</code>)}
    </div>
  );
}

function statusLabel(status: RuntimeTone): string {
  if (status === 'success') return 'OK';
  if (status === 'warning') return 'Check';
  if (status === 'error') return 'Issue';
  return 'Info';
}

function formatNullableBoolean(value: boolean | null): string {
  if (value === null) return 'not checked';
  return value ? 'active' : 'inactive';
}
