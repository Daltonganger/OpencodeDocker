import { useEffect, useMemo, useState } from 'react';
import { createAgent, deleteAgent, getAgents, getFullConfig, getProviders, updateAgent, updateFullConfig } from '@/api';
import type { AgentConfig, CouncilConfig, CouncilPreset, ProviderConfig } from '@/types';
import { Modal } from '@/components/Modal';

// ── Council defaults (same values as Council.tsx) ──────────────────────
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

// ── Shared primitives ──────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><div className="form-label">{label}</div>{children}</div>;
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-primary)', gap: 16 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'SF Mono, Menlo, monospace' : undefined }}>{value}</span>
    </div>
  );
}

// ── Count councillors inside a preset (excluding optional "master" key) ─
function councillorCount(preset: CouncilPreset): number {
  return Object.entries(preset).filter(([k]) => k !== 'master').length;
}

// ══════════════════════════════════════════════════════════════════════
//  CouncilSystemCard — inline, collapsible, full-width
// ══════════════════════════════════════════════════════════════════════
function CouncilSystemCard({
  initialCouncil,
  routing,
  onSaved,
}: {
  initialCouncil: CouncilConfig | null;
  routing: Record<string, unknown>;
  onSaved: (council: CouncilConfig | null) => void;
}) {
  // ── state ──
  const [council, setCouncil] = useState<CouncilConfig | null>(initialCouncil);
  const [savedCouncil, setSavedCouncil] = useState<CouncilConfig | null>(initialCouncil);
  const [expanded, setExpanded] = useState(false);
  const [presetsJson, setPresetsJson] = useState(() =>
    initialCouncil ? JSON.stringify(initialCouncil.presets, null, 2) : '',
  );
  const [masterFallbackStr, setMasterFallbackStr] = useState(() =>
    initialCouncil?.master_fallback?.join(', ') ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync when parent refreshes
  useEffect(() => {
    setCouncil(initialCouncil);
    setSavedCouncil(initialCouncil);
    setPresetsJson(initialCouncil ? JSON.stringify(initialCouncil.presets, null, 2) : '');
    setMasterFallbackStr(initialCouncil?.master_fallback?.join(', ') ?? '');
  }, [initialCouncil]);

  // ── actions ──
  const enable = () => {
    setCouncil(DEFAULT_COUNCIL);
    setSavedCouncil(null);
    setPresetsJson(JSON.stringify(DEFAULT_COUNCIL.presets, null, 2));
    setMasterFallbackStr(DEFAULT_COUNCIL.master_fallback?.join(', ') ?? '');
    setExpanded(true);
  };

  const cancel = () => {
    setCouncil(savedCouncil);
    setPresetsJson(savedCouncil ? JSON.stringify(savedCouncil.presets, null, 2) : '');
    setMasterFallbackStr(savedCouncil?.master_fallback?.join(', ') ?? '');
    setExpanded(false);
    setError(null);
    setMessage(null);
  };

  const save = async () => {
    if (!council) return;
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
      setSavedCouncil(updated);
      setPresetsJson(JSON.stringify(updated.presets, null, 2));
      setMasterFallbackStr(updated.master_fallback?.join(', ') ?? '');
      setMessage('Council config saved');
      setExpanded(false);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
    setSaving(false);
  };

  const disable = async () => {
    const nextRouting = { ...routing };
    delete nextRouting.council;
    await updateFullConfig({ routing: nextRouting as never });
    setCouncil(null);
    setSavedCouncil(null);
    setPresetsJson('');
    setMasterFallbackStr('');
    setExpanded(false);
    setMessage('Council disabled');
    setError(null);
    onSaved(null);
  };

  // ── preset keys for dropdown ──
  const presetKeys = council ? Object.keys(council.presets) : [];

  // ── render: empty state ──
  if (!council) {
    return (
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20 }}>🏛️</span>
            <h3 className="card-title">Council</h3>
            <span className="badge badge-info">Built-in</span>
            <span className="badge badge-success">Consensus</span>
          </div>
          <button type="button" className="btn btn-primary" onClick={enable}>Enable Council</button>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Multi-model synthesis &amp; consensus — configure parallel councillors with a master model.
        </div>
        {message && <div style={{ marginTop: 12, color: 'var(--color-success)', fontSize: 13 }}>{message}</div>}
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20 }}>🏛️</span>
            <h3 className="card-title">Council</h3>
            <span className="badge badge-info">Built-in</span>
            <span className="badge badge-success">Consensus</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Multi-model synthesis &amp; consensus — configure parallel councillors with a master model.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setExpanded((current) => !current)}>
            {expanded ? 'Collapse' : 'Configure'}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => void disable()}>Disable</button>
        </div>
      </div>

      <DetailRow label="Master model" value={council.master.model} mono />
      <DetailRow label="Default preset" value={council.default_preset ?? 'default'} />
      <DetailRow label="Presets" value={`${presetKeys.length} (${presetKeys.join(', ')})`} />
      <DetailRow label="Master timeout" value={`${(council.master_timeout ?? 300000) / 1000}s`} />

      {message && <div style={{ marginTop: 12, color: 'var(--accent-success)', fontSize: 13 }}>{message}</div>}
      {error && <div style={{ marginTop: 12, color: 'var(--accent-error)', fontSize: 13 }}>{error}</div>}

      <div className={`card-expandable-body${expanded ? ' expanded' : ''}`}>
        <div className="card-expandable-content">
          <div style={{ paddingTop: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, marginTop: 4 }}>Master</h4>
            <div className="grid grid-2">
              <Field label="Master model">
                <input
                  className="form-input"
                  value={council.master.model}
                  onChange={(e) => setCouncil({ ...council, master: { ...council.master, model: e.target.value } })}
                  placeholder="provider/model"
                />
              </Field>
              <Field label="Master variant">
                <select
                  className="form-select"
                  value={council.master.variant ?? ''}
                  onChange={(e) => setCouncil({ ...council, master: { ...council.master, variant: e.target.value || undefined } })}
                >
                  <option value="">— none —</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </Field>
            </div>
            <Field label="Master fallback (comma separated)">
              <input
                className="form-input"
                value={masterFallbackStr}
                onChange={(e) => setMasterFallbackStr(e.target.value)}
                placeholder="provider/model, provider/model"
              />
            </Field>

            <div className="grid grid-3" style={{ marginTop: 16 }}>
              <Field label="Default preset">
                <select
                  className="form-select"
                  value={council.default_preset ?? 'default'}
                  onChange={(e) => setCouncil({ ...council, default_preset: e.target.value })}
                >
                  {presetKeys.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </Field>
              <Field label="Master timeout (ms)">
                <input
                  className="form-input"
                  type="number"
                  value={council.master_timeout ?? 300000}
                  onChange={(e) => setCouncil({ ...council, master_timeout: Number(e.target.value) })}
                />
              </Field>
              <Field label="Councillors timeout (ms)">
                <input
                  className="form-input"
                  type="number"
                  value={council.councillors_timeout ?? 180000}
                  onChange={(e) => setCouncil({ ...council, councillors_timeout: Number(e.target.value) })}
                />
              </Field>
            </div>

            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, marginTop: 24 }}>Presets</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
              Each preset is a named group of councillors. The <code>master</code> key overrides the global master model for that preset.
            </p>
            {Object.entries(council.presets).map(([presetName, preset]) => (
              <div key={presetName} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {presetName}
                  {council.default_preset === presetName && <span className="badge badge-success" style={{ marginLeft: 8 }}>default</span>}
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8, fontSize: 12 }}>
                    {councillorCount(preset)} councillor{councillorCount(preset) !== 1 ? 's' : ''}
                  </span>
                </div>
                {Object.entries(preset).filter(([key]) => key !== 'master').map(([cName, cfg]) =>
                  cfg ? (
                    <div key={cName} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-primary)', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{cName}</span>
                      <span style={{ fontFamily: 'SF Mono, Menlo, monospace' }}>
                        {(cfg as { model: string; variant?: string }).model}
                        {(cfg as { variant?: string }).variant ? ` (${(cfg as { variant?: string }).variant})` : ''}
                      </span>
                    </div>
                  ) : null,
                )}
              </div>
            ))}

            <details style={{ marginTop: 16 }} open={false}>
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Advanced: Edit presets JSON
              </summary>
              <textarea
                className="form-textarea"
                style={{ minHeight: 320, fontFamily: 'SF Mono, Menlo, monospace', fontSize: 12 }}
                value={presetsJson}
                onChange={(e) => setPresetsJson(e.target.value)}
                spellCheck={false}
              />
            </details>

            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={cancel}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  Agents page
// ══════════════════════════════════════════════════════════════════════
export function Agents() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [routing, setRouting] = useState<Record<string, unknown> | null>(null);
  const [councilConfig, setCouncilConfig] = useState<CouncilConfig | null>(null);
  const [editing, setEditing] = useState<AgentConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerMap = useMemo(() => Object.fromEntries(providers.map((provider) => [provider.id, provider])), [providers]);

  useEffect(() => {
    void (async () => {
      try {
        const [agentsRes, providersRes, configRes] = await Promise.all([
          getAgents(),
          getProviders(),
          getFullConfig(),
        ]);
        setAgents(agentsRes.data);
        setProviders(providersRes.data);
        const r = configRes.data.routing as Record<string, unknown>;
        setRouting(r);
        setCouncilConfig((r.council as CouncilConfig | undefined) ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      }
    })();
  }, []);

  const modelsFor = (providerId: string) => providerMap[providerId]?.models ?? [];

  const openCreate = () => {
    const template = agents[0];
    setIsCreating(true);
    setEditing(template ? {
      ...structuredClone(template),
      id: '',
      builtIn: false,
      displayName: '',
      description: '',
    } : {
      id: '',
      builtIn: false,
      enabled: true,
      displayName: '',
      description: '',
      primary: { provider: providers[0]?.id ?? '', model: providers[0]?.models?.[0]?.id ?? '' },
      fallback: { provider: providers[0]?.id ?? '', model: providers[0]?.models?.[0]?.id ?? '' },
      temperature: 0.4,
      maxReasoningEffort: 'medium',
      mcpAccess: 'all',
      mcpAllowlist: [],
      mcpDenylist: [],
      skillsPolicy: 'all',
      skillsAllowlist: [],
      skillsDenylist: [],
      tmux: { enabled: true, sessionPrefix: 'cus' },
    });
  };

  const save = async () => {
    if (!editing) return;
    const response = isCreating
      ? await createAgent(editing)
      : await updateAgent(editing.id, editing);
    setAgents((current) => {
      if (isCreating) return [...current, response.data].sort((a, b) => Number(Boolean(b.builtIn)) - Number(Boolean(a.builtIn)) || a.displayName.localeCompare(b.displayName));
      return current.map((agent) => (agent.id === editing.id ? response.data : agent));
    });
    setEditing(null);
    setIsCreating(false);
  };

  const toggle = async (agent: AgentConfig) => {
    const response = await updateAgent(agent.id, { enabled: !agent.enabled });
    setAgents((current) => current.map((item) => (item.id === agent.id ? response.data : item)));
  };

  const handleCouncilSaved = (updated: CouncilConfig | null) => {
    setCouncilConfig(updated);
  };

  if (error) {
    return <div className="empty-state"><div className="empty-state-icon">⚠️</div><p>{error}</p></div>;
  }

  return (
    <div>
      {/* ── System Agents header ── */}
      <div className="page-section-header">
        <div>
          <h2 className="page-section-title">System Agents</h2>
          <p className="page-section-subtitle">Built-in system capabilities that run alongside your agents.</p>
        </div>
      </div>

      {/* ── Council System Agent card ── */}
      {routing && (
        <CouncilSystemCard
          initialCouncil={councilConfig}
          routing={routing}
          onSaved={handleCouncilSaved}
        />
      )}

      {/* ── Custom & Built-in Agents ── */}
      <div className="page-section-header">
        <div>
          <h2 className="page-section-title">Agents</h2>
          <p className="page-section-subtitle">Manage built-in agents and add your own custom agents.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>Add agent</button>
      </div>

      {!agents.length && <div className="empty-state"><div className="empty-state-icon">🤖</div><p>No agents found yet.</p></div>}

      <div className="grid grid-2">
        {agents.map((agent) => (
          <div key={agent.id} className="card">
            <div className="card-header">
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h3 className="card-title">{agent.displayName}</h3>
                  <span className={`badge ${agent.builtIn ? 'badge-info' : 'badge-success'}`}>{agent.builtIn ? 'Built-in' : 'Custom'}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{agent.description}</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={agent.enabled} onChange={() => toggle(agent)} />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <DetailRow label="Primary" value={`${agent.primary.provider} / ${agent.primary.model}`} mono />
            <DetailRow label="Fallback" value={`${agent.fallback.provider} / ${agent.fallback.model}`} mono />
            <DetailRow label="Temperature" value={agent.temperature.toString()} />
            <DetailRow label="Reasoning" value={agent.maxReasoningEffort} />
            <DetailRow label="Agent id" value={agent.id} mono />
            <DetailRow label="MCP access" value={agent.mcpAccess} />
            <DetailRow label="Skills" value={agent.skillsPolicy} />

            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(structuredClone(agent))}>Edit agent</button>
              {!agent.builtIn && <button type="button" className="btn btn-danger" onClick={async () => {
                await deleteAgent(agent.id);
                setAgents((current) => current.filter((item) => item.id !== agent.id));
              }}>Delete</button>}
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
        title={isCreating ? 'Add agent' : editing ? `Edit ${editing.displayName}` : 'Edit agent'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => {
              setEditing(null);
              setIsCreating(false);
            }}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={save}>Save</button>
          </>
        }
      >
        {editing && (
          <div>
            {isCreating && <Field label="Agent ID"><input className="form-input" value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value })} placeholder="researcher" /></Field>}
            <Field label="Display name"><input className="form-input" value={editing.displayName} onChange={(e) => setEditing({ ...editing, displayName: e.target.value })} /></Field>
            <Field label="Description"><textarea className="form-textarea" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div className="grid grid-2">
              <Field label="Primary provider">
                <select className="form-select" value={editing.primary.provider} onChange={(e) => setEditing({ ...editing, primary: { provider: e.target.value, model: modelsFor(e.target.value)[0]?.id ?? '' } })}>
                  {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.alias}</option>)}
                </select>
              </Field>
              <Field label="Primary model">
                <select className="form-select" value={editing.primary.model} onChange={(e) => setEditing({ ...editing, primary: { ...editing.primary, model: e.target.value } })}>
                  {modelsFor(editing.primary.provider).map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-2">
              <Field label="Fallback provider">
                <select className="form-select" value={editing.fallback.provider} onChange={(e) => setEditing({ ...editing, fallback: { provider: e.target.value, model: modelsFor(e.target.value)[0]?.id ?? '' } })}>
                  {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.alias}</option>)}
                </select>
              </Field>
              <Field label="Fallback model">
                <select className="form-select" value={editing.fallback.model} onChange={(e) => setEditing({ ...editing, fallback: { ...editing.fallback, model: e.target.value } })}>
                  {modelsFor(editing.fallback.provider).map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-3">
              <Field label="Temperature"><input className="form-input" type="number" step="0.1" min="0" max="1" value={editing.temperature} onChange={(e) => setEditing({ ...editing, temperature: Number(e.target.value) })} /></Field>
              <Field label="Reasoning"><select className="form-select" value={editing.maxReasoningEffort} onChange={(e) => setEditing({ ...editing, maxReasoningEffort: e.target.value as AgentConfig['maxReasoningEffort'] })}><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></Field>
              <Field label="MCP access"><select className="form-select" value={editing.mcpAccess} onChange={(e) => setEditing({ ...editing, mcpAccess: e.target.value as AgentConfig['mcpAccess'] })}><option value="all">all</option><option value="selected">selected</option><option value="none">none</option></select></Field>
            </div>
            <div className="grid grid-2">
              <Field label="Skills policy"><select className="form-select" value={editing.skillsPolicy} onChange={(e) => setEditing({ ...editing, skillsPolicy: e.target.value as AgentConfig['skillsPolicy'] })}><option value="all">all</option><option value="selected">selected</option><option value="none">none</option></select></Field>
              <Field label="Tmux prefix"><input className="form-input" value={editing.tmux.sessionPrefix} onChange={(e) => setEditing({ ...editing, tmux: { ...editing.tmux, sessionPrefix: e.target.value } })} /></Field>
            </div>
            <div className="grid grid-2">
              <Field label="MCP allowlist (comma separated)"><input className="form-input" value={editing.mcpAllowlist.join(', ')} onChange={(e) => setEditing({ ...editing, mcpAllowlist: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></Field>
              <Field label="Skills allowlist (comma separated)"><input className="form-input" value={editing.skillsAllowlist.join(', ')} onChange={(e) => setEditing({ ...editing, skillsAllowlist: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
