import { useEffect, useMemo, useState } from 'react';
import { getProvidersSource, updateProvidersSource } from '@/api';
import type { ProvidersSourceConfig } from '@/types';

export function ProvidersJson() {
  const [config, setConfig] = useState<ProvidersSourceConfig | null>(null);
  const [editorValue, setEditorValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await getProvidersSource();
      setConfig(response.data);
    })();
  }, []);

  const currentValue = useMemo(() => (config ? JSON.stringify(config, null, 2) : ''), [config]);

  useEffect(() => {
    setEditorValue(currentValue);
  }, [currentValue]);

  if (!config) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Providers JSON</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Raw editor for <code>providers.json</code>. Use this to supplement the synced model catalog manually.</p>
      </div>
      {message && <div className="card" style={{ marginBottom: 16 }}>{message}</div>}
      <div className="card">
        <textarea className="form-textarea" style={{ minHeight: 560, fontFamily: 'SF Mono, Menlo, monospace' }} value={editorValue} onChange={(e) => setEditorValue(e.target.value)} spellCheck={false} />
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button type="button" className="btn btn-secondary" onClick={() => setEditorValue(currentValue)}>Reset</button>
        <button type="button" className="btn btn-primary" onClick={async () => {
          const parsed = JSON.parse(editorValue) as ProvidersSourceConfig;
          const response = await updateProvidersSource(parsed);
          setConfig(response.data.providers);
          setMessage('Saved providers.json');
        }}>Save</button>
      </div>
    </div>
  );
}
