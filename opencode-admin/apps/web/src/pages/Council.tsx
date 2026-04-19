import { useEffect, useState } from 'react';
import { getFullConfig, updateFullConfig } from '@/api';
import type { CouncilConfig, CouncilPreset } from '@/types';

const DEFAULT_COUNCIL: CouncilConfig = {
  master: {
    model: 'github-copilot-acct-acct_eb51f2/claude-opus-4.6',
    variant: 'high',
  },
  master_fallback: ['github-copilot-acct-acct_eb51f2/claude-sonnet-4.6', 'openai/gpt-5.4'],
  default_preset: 'default',
  master_timeout: 300000,
  councillors_timeout: 180000,
  presets: {
    default: {
      alpha: { model: 'openai/gpt-5.4', variant: 'high' },
      beta: { model: 'github-copilot-acct-acct_0bc716/gemini-3.1-pro-preview', variant: 'medium' },
      gamma: { model: 'qwen-code/coder-model', variant: 'low' },
    },
    fast: {
      'quick-openai': { model: 'openai/gpt-5.4-mini' },
      'quick-qwen': { model: 'qwen-code/coder-model', variant: 'low' },
    },
  },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><div className="form-label">{label}</div>{children}</div>;
}

export function Council() {
  const [routing, setRouting] = useState<Record<string, unknown> | null>(null);
  const [council, setCouncil] = useState<CouncilConfig | null>(null);
  const [presetsJson, setPresetsJson] = useState('');
  const [masterFallbackStr, setMasterFallbackStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getFullConfig();
        const r = res.data.routing as Record<string, unknown>;
        setRouting(r);
        const c = r.council as CouncilConfig | undefined;
        if (c) {
          setCouncil(c);
          setPresetsJson(JSON.stringify(c.presets, null, 2));
          setMasterFallbackStr((c.master_fallback ?? []).join(', '));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load config');
      }
    })();
  }, []);

  const enable = () => {
    setCouncil(DEFAULT_COUNCIL);
    setPresetsJson(JSON.stringify(DEFAULT_COUNCIL.presets, null, 2));
    setMasterFallbackStr(DEFAULT_COUNCIL.master_fallback?.join(', ') ?? '');
  };

  const save = async () => {
    if (!council || !routing) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      let parsedPresets: Record<string, CouncilPreset>;
      try {
        parsedPresets = JSON.parse(presetsJson) as Record<string, CouncilPreset>;
      } catch {
        setError('Presets JSON is invalid');
        setSaving(false);
        return;
      }
      const updated: CouncilConfig = {
        ...council,
        presets: parsedPresets,
        master_fallback: masterFallbackStr.split(',').map((s) => s.trim()).filter(Boolean),
      };
      const nextRouting = { ...routing, council: updated };
      await updateFullConfig({ routing: nextRouting as never });
      setCouncil(updated);
      setMessage('Council config saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!routing) return;
    const nextRouting = { ...routing };
    delete nextRouting.council;
    await updateFullConfig({ routing: nextRouting as never });
    setCouncil(null);
    setPresetsJson('');
    setMasterFallbackStr('');
    setMessage('Council disabled');
  };

  if (error && !council) return <div className="empty-state"><div className="empty-state-icon">⚠️</div><p>{error}</p></div>;
  if (!routing) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>Council</h2>
            <span className="badge badge-info">oh-my-opencode-slim</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Multi-LLM consensus: meerdere modellen parallel, één synthetisch antwoord.</p>
        </div>
      </div>

      {message && <div className="card" style={{ marginBottom: 16, color: 'var(--color-success)' }}>{message}</div>}
      {error && <div className="card" style={{ marginBottom: 16, color: 'var(--color-danger)' }}>{error}</div>}

      {!council ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏛️</div>
          <p>Council is nog niet geconfigureerd.</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={enable}>Enable Council</button>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>Master</h3>
            <div className="grid grid-2">
              <Field label="Master model">
                <input className="form-input" value={council.master.model} onChange={(e) => setCouncil({ ...council, master: { ...council.master, model: e.target.value } })} placeholder="provider/model" />
              </Field>
              <Field label="Master variant">
                <select className="form-select" value={council.master.variant ?? ''} onChange={(e) => setCouncil({ ...council, master: { ...council.master, variant: e.target.value || undefined } })}>
                  <option value="">— none —</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </Field>
            </div>
            <Field label="Master fallback (comma separated)">
              <input className="form-input" value={masterFallbackStr} onChange={(e) => setMasterFallbackStr(e.target.value)} placeholder="provider/model, provider/model" />
            </Field>
            <div className="grid grid-3">
              <Field label="Default preset">
                <input className="form-input" value={council.default_preset ?? 'default'} onChange={(e) => setCouncil({ ...council, default_preset: e.target.value })} />
              </Field>
              <Field label="Master timeout (ms)">
                <input className="form-input" type="number" value={council.master_timeout ?? 300000} onChange={(e) => setCouncil({ ...council, master_timeout: Number(e.target.value) })} />
              </Field>
              <Field label="Councillors timeout (ms)">
                <input className="form-input" type="number" value={council.councillors_timeout ?? 180000} onChange={(e) => setCouncil({ ...council, councillors_timeout: Number(e.target.value) })} />
              </Field>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 8 }}>Presets</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
              Elke preset is een named groep councillors. De <code>master</code> key in een preset overschrijft het globale master model voor die preset.
            </p>
            {Object.entries(council.presets).map(([presetName, preset]) => (
              <div key={presetName} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{presetName}{council.default_preset === presetName && <span className="badge badge-success" style={{ marginLeft: 8 }}>default</span>}</div>
                {Object.entries(preset).filter(([key]) => key !== 'master').map(([councillorName, cfg]) => (
                  cfg && (
                    <div key={councillorName} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-primary)', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{councillorName}</span>
                      <span style={{ fontFamily: 'SF Mono, Menlo, monospace' }}>{(cfg as { model: string; variant?: string }).model}{(cfg as { variant?: string }).variant ? ` (${(cfg as { variant?: string }).variant})` : ''}</span>
                    </div>
                  )
                ))}
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <div className="form-label">Presets JSON (direct edit)</div>
              <textarea className="form-textarea" style={{ minHeight: 320, fontFamily: 'SF Mono, Menlo, monospace', fontSize: 12 }} value={presetsJson} onChange={(e) => setPresetsJson(e.target.value)} spellCheck={false} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn btn-danger" onClick={() => void remove()}>Disable Council</button>
          </div>
        </>
      )}
    </div>
  );
}
