import { useEffect, useState } from 'react';
import { createMCPServer, deleteMCPServer, getMCPServers, testMCPServer, toggleMCPServer, updateMCPServer } from '@/api';
import type { MCPServer } from '@/types';
import { Modal } from '@/components/Modal';

export function MCPServers() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [editing, setEditing] = useState<MCPServer | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await getMCPServers();
        setServers(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load MCP servers');
      }
    })();
  }, []);

  if (error) return <div className="empty-state"><div className="empty-state-icon">⚠️</div><p>{error}</p></div>;
  return (
    <div>
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>MCP Servers</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Control the MCP registry, env refs and connection tests.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => {
          setIsCreating(true);
          setEditing({ id: '', name: '', enabled: true, type: 'local', command: 'npx', args: [], envRefs: [], transport: 'stdio', description: '' });
        }}>Add MCP server</button>
      </div>

      {testMessage && <div className="card" style={{ marginBottom: 16 }}>{testMessage}</div>}
      {!servers.length && <div className="empty-state"><div className="empty-state-icon">🖥️</div><p>Nog geen MCP servers gevonden.</p></div>}

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Server</th>
                <th>Transport</th>
                <th>Env refs</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((server) => (
                <tr key={server.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{server.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{server.command ? `${server.command} ${(server.args ?? []).join(' ')}` : server.url}</div>
                  </td>
                  <td><span className="badge badge-info">{server.transport}</span></td>
                  <td><code>{server.envRefs.join(', ') || 'none'}</code></td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={server.enabled} onChange={async () => {
                        const response = await toggleMCPServer(server.id, !server.enabled);
                        setServers((current) => current.map((item) => item.id === server.id ? response.data : item));
                      }} />
                      <span className="toggle-slider"></span>
                    </label>
                  </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setEditing(structuredClone(server))}>Edit</button>
                      <button type="button" className="btn btn-secondary" onClick={async () => {
                          const response = await testMCPServer(server.id);
                          setTestMessage(`${response.data.id}: ${response.data.message}`);
                        }}>Test</button>
                        <button type="button" className="btn btn-danger" onClick={async () => {
                          await deleteMCPServer(server.id);
                          setServers((current) => current.filter((item) => item.id !== server.id));
                        }}>Delete</button>
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={Boolean(editing)}
        onClose={() => {
          setEditing(null);
          setIsCreating(false);
        }}
        title={isCreating ? 'Add MCP server' : editing ? `Edit ${editing.name}` : 'Edit MCP server'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => {
              setEditing(null);
              setIsCreating(false);
            }}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={async () => {
              if (!editing) return;
              const response = isCreating ? await createMCPServer(editing) : await updateMCPServer(editing.id, editing);
              setServers((current) => isCreating ? [...current, response.data] : current.map((item) => item.id === editing.id ? response.data : item));
              setEditing(null);
              setIsCreating(false);
            }}>Save</button>
          </>
        }
      >
        {editing && (
          <div>
            {isCreating && <Field label="Server ID"><input className="form-input" value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value })} /></Field>}
            <div className="grid grid-2">
              <Field label="Name"><input className="form-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Type"><select className="form-select" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as MCPServer['type'] })}><option value="local">local</option><option value="remote">remote</option></select></Field>
            </div>
            <div className="grid grid-2">
              <Field label="Transport"><select className="form-select" value={editing.transport} onChange={(e) => setEditing({ ...editing, transport: e.target.value as MCPServer['transport'] })}><option value="stdio">stdio</option><option value="http">http</option><option value="sse">sse</option></select></Field>
              <Field label="Enabled"><select className="form-select" value={String(editing.enabled)} onChange={(e) => setEditing({ ...editing, enabled: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></Field>
            </div>
            <Field label="Description"><textarea className="form-textarea" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            {editing.type === 'remote'
              ? <Field label="URL"><input className="form-input" value={editing.url ?? ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} /></Field>
              : <>
                  <Field label="Command"><input className="form-input" value={editing.command ?? ''} onChange={(e) => setEditing({ ...editing, command: e.target.value })} /></Field>
                  <Field label="Arguments (comma separated)"><input className="form-input" value={(editing.args ?? []).join(', ')} onChange={(e) => setEditing({ ...editing, args: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></Field>
                </>}
            <Field label="Env refs (comma separated)"><input className="form-input" value={editing.envRefs.join(', ')} onChange={(e) => setEditing({ ...editing, envRefs: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><div className="form-label">{label}</div>{children}</div>;
}
