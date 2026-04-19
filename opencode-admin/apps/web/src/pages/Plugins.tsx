import { useCallback, useEffect, useState } from 'react';
import { createPlugin, deletePlugin, getPlugins, togglePlugin, updatePlugin } from '@/api';
import type { PluginConfig } from '@/types';
import { Modal } from '@/components/Modal';

export function Plugins() {
  const [plugins, setPlugins] = useState<PluginConfig[]>([]);
  const [editing, setEditing] = useState<PluginConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await getPlugins();
      setPlugins(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plugins');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) return <div className="empty-state"><div className="empty-state-icon">⚠️</div><p>{error}</p></div>;
  return (
    <div>
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Plugins</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Control the OpenCode plugin set and ordering.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => {
          setIsCreating(true);
          setEditing({ id: '', name: '', package: '', enabled: true, order: plugins.length + 1, version: 'latest', description: '', required: false });
        }}>Add plugin</button>
      </div>

      {!plugins.length && <div className="empty-state"><div className="empty-state-icon">🔌</div><p>Nog geen plugins gevonden.</p></div>}

      <div className="grid grid-2">
        {plugins.map((plugin) => (
          <div key={plugin.id} className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">{plugin.name}</h3>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{plugin.package}</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={plugin.enabled} onChange={async () => {
                  const response = await togglePlugin(plugin.id, !plugin.enabled);
                  setPlugins((current) => current.map((item) => item.id === plugin.id ? response.data : item));
                }} />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>{plugin.description}</div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div>Order: <strong>{plugin.order}</strong></div>
              <div>Version: <strong>{plugin.version}</strong></div>
              {plugin.required && <span className="badge badge-success">Required</span>}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(structuredClone(plugin))}>Edit plugin</button>
              <button type="button" className="btn btn-danger" onClick={async () => {
                await deletePlugin(plugin.id);
                setPlugins((current) => current.filter((item) => item.id !== plugin.id));
              }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={Boolean(editing)}
        onClose={() => {
          setEditing(null);
          setIsCreating(false);
        }}
        title={isCreating ? 'Add plugin' : editing ? `Edit ${editing.name}` : 'Edit plugin'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => {
              setEditing(null);
              setIsCreating(false);
            }}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={async () => {
              if (!editing) return;
              const response = isCreating ? await createPlugin(editing) : await updatePlugin(editing.id, editing);
              setPlugins((current) => isCreating ? [...current, response.data].sort((a, b) => a.order - b.order) : current.map((item) => item.id === editing.id ? response.data : item));
              setEditing(null);
              setIsCreating(false);
            }}>Save</button>
          </>
        }
      >
        {editing && (
          <div>
            {isCreating && <Field label="Plugin ID"><input className="form-input" value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value })} /></Field>}
            <div className="grid grid-2">
              <Field label="Name"><input className="form-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Package"><input className="form-input" value={editing.package} onChange={(e) => setEditing({ ...editing, package: e.target.value })} /></Field>
            </div>
            <Field label="Description"><textarea className="form-textarea" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div className="grid grid-2">
              <Field label="Order"><input className="form-input" type="number" value={editing.order} onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })} /></Field>
              <Field label="Version"><input className="form-input" value={editing.version} onChange={(e) => setEditing({ ...editing, version: e.target.value })} /></Field>
            </div>
            <Field label="Required"><select className="form-select" value={String(Boolean(editing.required))} onChange={(e) => setEditing({ ...editing, required: e.target.value === 'true' })}><option value="false">No</option><option value="true">Yes</option></select></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><div className="form-label">{label}</div>{children}</div>;
}
