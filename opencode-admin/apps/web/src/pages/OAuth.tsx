import { useCallback, useEffect, useState } from 'react';
import { getOAuthConfigs, updateOAuthConfig } from '@/api';
import type { OAuthConfig } from '@/types';
import { Modal } from '@/components/Modal';

export function OAuth() {
  const [items, setItems] = useState<OAuthConfig[]>([]);
  const [editing, setEditing] = useState<OAuthConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await getOAuthConfigs();
      setItems(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OAuth configuration');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) return <div className="empty-state"><div className="empty-state-icon">⚠️</div><p>{error}</p></div>;
  if (!items.length) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>OAuth</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Beheer authenticatie voor GitHub, Google en Qwen. Alle drie gebruiken directe OpenCode runtime-login.</p>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Configured</th>
                <th>Connected</th>
                <th>Account & Method</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.displayName}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{item.scopes.join(', ')}</div>
                  </td>
                  <td><span className={`badge ${item.configured ? 'badge-success' : 'badge-warning'}`}>{item.configured ? 'Configured' : 'Unconfigured'}</span></td>
                  <td><span className={`badge ${item.connected ? 'badge-success' : 'badge-warning'}`}>{item.connected ? 'Connected' : 'Not connected'}</span></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.accountSummary ?? 'Nog geen loginstatus'}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {item.loginMode === 'direct' ? 'Runtime login' : item.loginMode === 'browser' ? 'Device code flow' : item.callbackUrl}
                    </div>
                    {item.error && <div style={{ color: 'var(--accent-warning)', fontSize: 12, marginTop: 4 }}>{item.error}</div>}
                  </td>
                  <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {item.loginUrl ? (
                          <a className="btn btn-primary" href={item.loginEnabled ? item.loginUrl : undefined} target="_blank" rel="noreferrer" aria-disabled={!item.loginEnabled} onClick={(event) => {
                            if (!item.loginEnabled) event.preventDefault();
                          }} style={!item.loginEnabled ? { pointerEvents: 'auto', opacity: 0.5 } : undefined}>
                            {item.loginLabel ?? 'Open login'}
                          </a>
                        ) : (
                          <span className="badge badge-warning">Nog niet ondersteund</span>
                        )}
                        <button type="button" className="btn btn-secondary" onClick={() => setEditing(structuredClone(item))}>Edit</button>
                      </div>
                  </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Authenticatiemethodes:</strong> GitHub, Google en Qwen gebruiken een directe runtime login via <code>/copilot-auth</code>, <code>/google-auth</code> en <code>/qwen-auth</code>.
        </div>
      </div>

      <Modal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.displayName}` : 'Edit OAuth provider'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={async () => {
              if (!editing) return;
              await updateOAuthConfig(editing.id, {
                enabled: editing.enabled,
                scopes: editing.scopes,
                callbackPath: editing.callbackPath,
              });
              setEditing(null);
              await load();
            }}>Save</button>
          </>
        }
      >
        {editing && (
          <div>
            {editing.loginMode === 'browser' ? (
              <>
                <Field label="Client ID ref"><input className="form-input" value={editing.clientIdRef} readOnly /></Field>
                <Field label="Client secret ref"><input className="form-input" value={editing.clientSecretRef} readOnly /></Field>
                <Field label="Callback path"><input className="form-input" value={editing.callbackPath} onChange={(e) => setEditing({ ...editing, callbackPath: e.target.value })} /></Field>
              </>
            ) : (
              <div className="form-group">
                <div className="form-label">Runtime login</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                  Deze provider gebruikt de directe runtime-login van OpenCode.
                </div>
              </div>
            )}
            <Field label="Scopes"><input className="form-input" value={editing.scopes.join(', ')} onChange={(e) => setEditing({ ...editing, scopes: e.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} /></Field>
            <label className="toggle" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="checkbox" checked={editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} />
              <span className="toggle-slider"></span>
              <span>Enabled</span>
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><div className="form-label">{label}</div>{children}</div>;
}
