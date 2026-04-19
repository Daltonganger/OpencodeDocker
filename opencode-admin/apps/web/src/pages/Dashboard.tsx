import { useEffect, useState } from 'react';
import { getDashboardStats } from '@/api';
import type { DashboardStats } from '@/types';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardStats().then((response) => setStats(response.data)).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'));
  }, []);

  if (error) {
    return <div className="empty-state"><div className="empty-state-icon">⚠️</div><p>{error}</p></div>;
  }

  if (!stats) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <StatCard label="Agents" value={stats.stats.agents.total} subtext={`${stats.stats.agents.enabled} enabled`} />
        <StatCard label="Plugins" value={stats.stats.plugins.total} subtext={`${stats.stats.plugins.enabled} enabled`} />
        <StatCard label="Providers" value={stats.stats.providers.total} subtext={`${stats.stats.providers.enabled} enabled`} />
        <StatCard label="MCP Servers" value={stats.stats.mcpServers.total} subtext={`${stats.stats.mcpServers.enabled} enabled`} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Current Runtime</h3></div>
          <InfoRow label="Target stack" value={stats.targetStackPath} mono />
          <InfoRow label="Current release" value={stats.currentRelease?.id ?? 'none'} mono />
          <InfoRow label="Last applied" value={stats.lastApplied ? new Date(stats.lastApplied).toLocaleString() : 'never'} />
          <InfoRow label="Pending state" value={stats.dirty ? 'Pending changes' : 'Clean'} status={stats.dirty ? 'warning' : 'success'} />
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">OAuth & Secrets</h3></div>
          <InfoRow label="OAuth configured" value={`${stats.stats.oauth.configured}/${stats.stats.oauth.total}`} />
          <InfoRow label="OAuth connected" value={`${stats.stats.oauth.connected}/${stats.stats.oauth.total}`} />
          <InfoRow label="Secrets configured" value={`${stats.stats.secrets.configured}/${stats.stats.secrets.total}`} />
          <InfoRow label="Secrets missing" value={`${stats.stats.secrets.missing}`} status={stats.stats.secrets.missing > 0 ? 'warning' : 'success'} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header"><h3 className="card-title">Pending Changes</h3></div>
        {stats.pendingChanges.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No pending changes detected.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {stats.pendingChanges.map((item) => (
              <div key={item} style={{ padding: 12, border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)' }}>
                {item}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext }: { label: string; value: number; subtext: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-change">{subtext}</div>
    </div>
  );
}

function InfoRow({ label, value, mono, status }: { label: string; value: string; mono?: boolean; status?: 'warning' | 'success' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border-primary)' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'SF Mono, Menlo, monospace' : undefined, color: status === 'warning' ? 'var(--accent-warning)' : status === 'success' ? 'var(--accent-success)' : 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
