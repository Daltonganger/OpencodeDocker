import { useCallback, useEffect, useState } from 'react';
import { deleteSecret, getSecrets, setSecret } from '@/api';
import type { Secret } from '@/types';
import { Modal } from '@/components/Modal';

export function Secrets() {
  const [items, setItems] = useState<Secret[]>([]);
  const [selected, setSelected] = useState<Secret | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await getSecrets();
      setItems(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load secrets');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) return <div className="empty-state"><div className="empty-state-icon">⚠️</div><p>{error}</p></div>;
  if (!items.length) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Secrets</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Secrets stay masked. You can only set, replace or clear values.</p>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Category</th>
                <th>Status</th>
                <th>Masked</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.key}>
                  <td><code>{item.key}</code></td>
                  <td>{item.category}</td>
                  <td><span className={`badge ${item.configured ? 'badge-success' : item.required ? 'badge-error' : 'badge-warning'}`}>{item.configured ? 'Configured' : item.required ? 'Required missing' : 'Optional missing'}</span></td>
                  <td>{item.maskedValue}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn btn-secondary" onClick={() => { setSelected(item); setValue(''); }}>Set / replace</button>
                      {item.configured && <button type="button" className="btn btn-danger" onClick={async () => { await deleteSecret(item.key); await load(); }}>Clear</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => { setSelected(null); setValue(''); }}
        title={selected ? `Set ${selected.displayName}` : 'Set secret'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setSelected(null); setValue(''); }}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={async () => {
              if (!selected || !value) return;
              await setSecret(selected.key, value);
              setSelected(null);
              setValue('');
              await load();
            }}>Save</button>
          </>
        }
      >
        {selected && (
          <div>
            <Field label="Target key"><input className="form-input" value={selected.key} readOnly /></Field>
            <Field label="New value"><textarea className="form-textarea" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><div className="form-label">{label}</div>{children}</div>;
}
