import { useEffect, useMemo, useState } from 'react';
import { getFullConfig, updateFullConfig } from '@/api';
import type { CombinedConfig } from '@/types';

const FILE_OPTIONS: Array<keyof CombinedConfig> = ['routing', 'plugins', 'providers', 'mcp', 'oauth', 'features', 'secretsRefs'];

export function Advanced() {
  const [config, setConfig] = useState<CombinedConfig | null>(null);
  const [selectedFile, setSelectedFile] = useState<keyof CombinedConfig>('routing');
  const [editorValue, setEditorValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await getFullConfig();
      setConfig(response.data);
    })();
  }, []);

  const currentValue = useMemo(() => {
    if (!config) return '';
    return JSON.stringify(config[selectedFile], null, 2);
  }, [config, selectedFile]);

  useEffect(() => { setEditorValue(currentValue); }, [currentValue]);

  if (!config) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Advanced JSON</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Allowlisted raw editor for exceptional cases.</p>
      </div>
      {message && <div className="card" style={{ marginBottom: 16 }}>{message}</div>}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Source file</h3>
          <select className="form-select" value={selectedFile} onChange={(e) => setSelectedFile(e.target.value as keyof CombinedConfig)} style={{ maxWidth: 240 }}>
            {FILE_OPTIONS.map((file) => <option key={file} value={file}>{file}</option>)}
          </select>
        </div>
        <textarea className="form-textarea" style={{ minHeight: 520, fontFamily: 'SF Mono, Menlo, monospace' }} value={editorValue} onChange={(e) => setEditorValue(e.target.value)} spellCheck={false} />
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button type="button" className="btn btn-secondary" onClick={() => setEditorValue(currentValue)}>Reset</button>
        <button type="button" className="btn btn-primary" onClick={async () => {
          const parsed = JSON.parse(editorValue) as Record<string, unknown>;
          const response = await updateFullConfig({ [selectedFile]: parsed } as Partial<CombinedConfig>);
          setConfig(response.data);
          setMessage(`Saved ${selectedFile}`);
        }}>Save</button>
      </div>
    </div>
  );
}
