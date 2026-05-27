import { useEffect, useMemo, useState } from 'react';
import { createAgent, deleteAgent, getAgents, getFullConfig, getProviders, updateAgent, updateFullConfig } from '@/api';
import type { AgentConfig, CouncilConfig, CouncilPreset, PresetAgentConfig, ProviderConfig, ProvidersSourceConfig, RoutingConfig } from '@/types';
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
    <div className="info-row">
      <span className="info-row-label">{label}</span>
      <span className={`info-row-value ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  );
}

type ModelSelection = { provider: string; model: string; variant?: string };

function splitModelRef(value?: string): { provider: string; model: string } {
  const ref = value ?? '';
  const slashIndex = ref.indexOf('/');
  if (slashIndex === -1) return { provider: '', model: ref };
  return { provider: ref.slice(0, slashIndex), model: ref.slice(slashIndex + 1) };
}

function joinModelRef(provider: string, model: string): string {
  if (!provider) return model;
  if (!model) return provider;
  return `${provider}/${model}`;
}

function csv(value?: string[]): string {
  return (value ?? []).join(', ');
}

function fromCsv(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function providerModels(providers: ProviderConfig[], providerId: string) {
  return providers.find((provider) => provider.id === providerId)?.models ?? [];
}

function ModelPicker({
  providers,
  value,
  onChange,
  variant = true,
}: {
  providers: ProviderConfig[];
  value: ModelSelection;
  onChange: (next: ModelSelection) => void;
  variant?: boolean;
}) {
  const models = providerModels(providers, value.provider);
  return (
    <div className={variant ? 'grid grid-3' : 'grid grid-2'}>
      <Field label="Provider">
        <select
          className="form-select"
          value={value.provider}
          onChange={(event) => {
            const provider = event.target.value;
            onChange({ ...value, provider, model: providerModels(providers, provider)[0]?.id ?? '' });
          }}
        >
          <option value="">— select —</option>
          {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.alias || provider.id}</option>)}
        </select>
      </Field>
      <Field label="Model">
        <select className="form-select" value={value.model} onChange={(event) => onChange({ ...value, model: event.target.value })}>
          <option value="">— select —</option>
          {models.map((model) => <option key={model.id} value={model.id}>{model.name || model.id}</option>)}
          {value.model && !models.some((model) => model.id === value.model) && <option value={value.model}>{value.model}</option>}
        </select>
      </Field>
      {variant && (
        <Field label="Variant">
          <input
            className="form-input"
            list="model-variant-options"
            value={value.variant ?? ''}
            onChange={(event) => onChange({ ...value, variant: event.target.value || undefined })}
            placeholder="default / high / medium"
          />
        </Field>
      )}
    </div>
  );
}

function FullModelPicker({
  providers,
  value,
  variant,
  onChange,
  showVariant = true,
}: {
  providers: ProviderConfig[];
  value: string;
  variant?: string;
  onChange: (model: string, variant?: string) => void;
  showVariant?: boolean;
}) {
  return (
    <ModelPicker
      providers={providers}
      value={{ ...splitModelRef(value), variant }}
      variant={showVariant}
      onChange={(next) => onChange(joinModelRef(next.provider, next.model), next.variant)}
    />
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
  providers,
  onSaved,
}: {
  initialCouncil: CouncilConfig | null;
  routing: RoutingConfig;
  providers: ProviderConfig[];
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

  const updateCouncilPresets = (nextPresets: Record<string, CouncilPreset>) => {
    if (!council) return;
    setCouncil({ ...council, presets: nextPresets });
    setPresetsJson(JSON.stringify(nextPresets, null, 2));
  };

  const renameCouncilPreset = (from: string, to: string) => {
    if (!council || !to || from === to || council.presets[to]) return;
    const nextPresets: Record<string, CouncilPreset> = {};
    for (const [name, preset] of Object.entries(council.presets)) {
      nextPresets[name === from ? to : name] = preset;
    }
    updateCouncilPresets(nextPresets);
    if (council.default_preset === from) setCouncil({ ...council, default_preset: to, presets: nextPresets });
  };

  const updateCouncilPresetEntry = (presetName: string, entryName: string, nextName: string, patch: { model?: string; variant?: string; prompt?: string }) => {
    if (!council || !nextName) return;
    const preset = { ...(council.presets[presetName] ?? {}) };
    const current = (preset[entryName] ?? {}) as { model?: string; variant?: string; prompt?: string };
    if (entryName !== nextName) delete preset[entryName];
    preset[nextName] = { ...current, ...patch };
    updateCouncilPresets({ ...council.presets, [presetName]: preset });
  };

  const deleteCouncilPresetEntry = (presetName: string, entryName: string) => {
    if (!council) return;
    const preset = { ...(council.presets[presetName] ?? {}) };
    delete preset[entryName];
    updateCouncilPresets({ ...council.presets, [presetName]: preset });
  };

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
              <div key={presetName} style={{ border: '1px solid var(--border-primary)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <input
                    className="form-input"
                    style={{ maxWidth: 220, fontWeight: 600 }}
                    value={presetName}
                    onChange={(e) => renameCouncilPreset(presetName, e.target.value)}
                  />
                  {council.default_preset === presetName && <span className="badge badge-success" style={{ marginLeft: 8 }}>default</span>}
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8, fontSize: 12 }}>
                    {councillorCount(preset)} councillor{councillorCount(preset) !== 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const name = window.prompt('Councillor name', `councillor-${councillorCount(preset) + 1}`);
                      if (!name) return;
                      updateCouncilPresetEntry(presetName, name, name, { model: council.master.model, variant: council.master.variant });
                    }}
                  >Add councillor</button>
                </div>
                {Object.entries(preset).map(([cName, cfg]) =>
                  cfg ? (
                    <div key={cName} style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 10, marginTop: 10 }}>
                      <div className="grid grid-2">
                        <Field label={cName === 'master' ? 'Master override' : 'Councillor name'}>
                          <input
                            className="form-input"
                            value={cName}
                            disabled={cName === 'master'}
                            onChange={(e) => updateCouncilPresetEntry(presetName, cName, e.target.value, {})}
                          />
                        </Field>
                        <Field label="Prompt">
                          <input
                            className="form-input"
                            value={(cfg as { prompt?: string }).prompt ?? ''}
                            onChange={(e) => updateCouncilPresetEntry(presetName, cName, cName, { prompt: e.target.value || undefined })}
                          />
                        </Field>
                      </div>
                      <FullModelPicker
                        providers={providers}
                        value={(cfg as { model?: string }).model ?? ''}
                        variant={(cfg as { variant?: string }).variant}
                        onChange={(model, variant) => updateCouncilPresetEntry(presetName, cName, cName, { model, variant })}
                      />
                      <button type="button" className="btn btn-danger" onClick={() => deleteCouncilPresetEntry(presetName, cName)}>Remove</button>
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

function RoutingDefaultsCard({
  routing,
  providersSource,
  providers,
  agents,
  onSaved,
}: {
  routing: RoutingConfig;
  providersSource: ProvidersSourceConfig;
  providers: ProviderConfig[];
  agents: AgentConfig[];
  onSaved: (routing: RoutingConfig, providersSource: ProvidersSourceConfig) => void;
}) {
  const metadata = routing.metadata ?? {};
  const providerMetadata = providersSource.metadata ?? {};
  const [model, setModel] = useState(typeof metadata.model === 'string' ? metadata.model : '');
  const [smallModel, setSmallModel] = useState(typeof metadata.smallModel === 'string' ? metadata.smallModel : '');
  const [defaultAgent, setDefaultAgent] = useState(typeof metadata.defaultAgent === 'string' ? metadata.defaultAgent : 'orchestrator');
  const [defaultPreset, setDefaultPreset] = useState(routing.defaultPreset);
  const [instructions, setInstructions] = useState(csv(Array.isArray(metadata.instructions) ? metadata.instructions as string[] : []));
  const [disabledProviders, setDisabledProviders] = useState(csv(Array.isArray(providerMetadata.disabledProviders) ? providerMetadata.disabledProviders as string[] : []));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextMetadata = routing.metadata ?? {};
    const nextProviderMetadata = providersSource.metadata ?? {};
    setModel(typeof nextMetadata.model === 'string' ? nextMetadata.model : '');
    setSmallModel(typeof nextMetadata.smallModel === 'string' ? nextMetadata.smallModel : '');
    setDefaultAgent(typeof nextMetadata.defaultAgent === 'string' ? nextMetadata.defaultAgent : 'orchestrator');
    setDefaultPreset(routing.defaultPreset);
    setInstructions(csv(Array.isArray(nextMetadata.instructions) ? nextMetadata.instructions as string[] : []));
    setDisabledProviders(csv(Array.isArray(nextProviderMetadata.disabledProviders) ? nextProviderMetadata.disabledProviders as string[] : []));
  }, [routing, providersSource]);

  const save = async () => {
    setMessage(null);
    setError(null);
    try {
      const nextRouting: RoutingConfig = {
        ...routing,
        defaultPreset,
        metadata: {
          ...(routing.metadata ?? {}),
          model: model || undefined,
          smallModel: smallModel || undefined,
          defaultAgent: defaultAgent || undefined,
          instructions: fromCsv(instructions),
        },
      };
      const nextProvidersSource: ProvidersSourceConfig = {
        ...providersSource,
        metadata: {
          ...(providersSource.metadata ?? {}),
          disabledProviders: fromCsv(disabledProviders),
        },
      };
      const response = await updateFullConfig({ routing: nextRouting as never, providers: nextProvidersSource });
      onSaved(response.data.routing as unknown as RoutingConfig, response.data.providers);
      setMessage('Defaults opgeslagen');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div>
          <h3 className="card-title">OpenCode defaults</h3>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Top-level model, small model, default agent, actieve preset en disabled providers.
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void save()}>Save defaults</button>
      </div>
      <div className="grid grid-2">
        <div>
          <h4 style={{ fontSize: 13, marginBottom: 8 }}>Model</h4>
          <FullModelPicker providers={providers} value={model} showVariant={false} onChange={(next) => setModel(next)} />
        </div>
        <div>
          <h4 style={{ fontSize: 13, marginBottom: 8 }}>Small model</h4>
          <FullModelPicker providers={providers} value={smallModel} showVariant={false} onChange={(next) => setSmallModel(next)} />
        </div>
      </div>
      <div className="grid grid-3" style={{ marginTop: 12 }}>
        <Field label="Default agent">
          <select className="form-select" value={defaultAgent} onChange={(event) => setDefaultAgent(event.target.value)}>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.displayName || agent.id}</option>)}
            {defaultAgent && !agents.some((agent) => agent.id === defaultAgent) && <option value={defaultAgent}>{defaultAgent}</option>}
          </select>
        </Field>
        <Field label="Active oh-my preset">
          <select className="form-select" value={defaultPreset} onChange={(event) => setDefaultPreset(event.target.value)}>
            {Object.keys(routing.presets ?? {}).map((preset) => <option key={preset} value={preset}>{routing.presets[preset]?.name || preset}</option>)}
          </select>
        </Field>
        <Field label="Disabled providers">
          <input className="form-input" value={disabledProviders} onChange={(event) => setDisabledProviders(event.target.value)} placeholder="qwen, qwen-code, kiro" />
        </Field>
      </div>
      <Field label="Instructions">
        <input className="form-input" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="comma separated paths" />
      </Field>
      {message && <div style={{ color: 'var(--accent-success)', fontSize: 13 }}>{message}</div>}
      {error && <div style={{ color: 'var(--accent-error)', fontSize: 13 }}>{error}</div>}
    </div>
  );
}

function AgentPresetRoutingCard({
  routing,
  providers,
  agents,
  onSaved,
}: {
  routing: RoutingConfig;
  providers: ProviderConfig[];
  agents: AgentConfig[];
  onSaved: (routing: RoutingConfig) => void;
}) {
  const presetIds = Object.keys(routing.presets ?? {});
  const [selectedPreset, setSelectedPreset] = useState(routing.defaultPreset || presetIds[0] || 'default');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const agentIds = useMemo(() => {
    const ids = new Set(agents.map((agent) => agent.id));
    for (const preset of Object.values(routing.agentPresets ?? {})) {
      Object.keys(preset).forEach((id) => ids.add(id));
    }
    return [...ids];
  }, [agents, routing.agentPresets]);

  const selectedInfo = routing.presets?.[selectedPreset] ?? { name: selectedPreset, description: '' };
  const selectedAgents = routing.agentPresets?.[selectedPreset] ?? {};

  const saveRouting = async (nextRouting: RoutingConfig, savedMessage: string) => {
    setMessage(null);
    setError(null);
    try {
      const response = await updateFullConfig({ routing: nextRouting as never });
      const updated = response.data.routing as unknown as RoutingConfig;
      onSaved(updated);
      setMessage(savedMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const updatePresetInfo = (patch: Partial<{ name: string; description: string }>) => {
    void saveRouting({
      ...routing,
      presets: { ...(routing.presets ?? {}), [selectedPreset]: { ...selectedInfo, ...patch } },
    }, 'Preset opgeslagen');
  };

  const updateAgentPreset = (agentId: string, patch: Partial<PresetAgentConfig>) => {
    const agent = agents.find((item) => item.id === agentId);
    const existing = selectedAgents[agentId] ?? {
      model: joinModelRef(agent?.primary.provider ?? '', agent?.primary.model ?? ''),
      variant: agent?.primary.variant,
      skills: [],
      mcps: [],
    };
    void saveRouting({
      ...routing,
      agentPresets: {
        ...(routing.agentPresets ?? {}),
        [selectedPreset]: { ...selectedAgents, [agentId]: { ...existing, ...patch } },
      },
    }, `${agentId} opgeslagen`);
  };

  const addPreset = () => {
    const id = window.prompt('Preset id');
    if (!id) return;
    if (routing.presets?.[id]) {
      setError('Preset bestaat al');
      return;
    }
    setSelectedPreset(id);
    void saveRouting({
      ...routing,
      presets: { ...(routing.presets ?? {}), [id]: { name: id, description: '' } },
      agentPresets: { ...(routing.agentPresets ?? {}), [id]: structuredClone(selectedAgents) },
    }, `Preset ${id} toegevoegd`);
  };

  const deletePreset = () => {
    if (presetIds.length <= 1 || !window.confirm(`Preset ${selectedPreset} verwijderen?`)) return;
    const nextPresets = { ...(routing.presets ?? {}) };
    const nextAgentPresets = { ...(routing.agentPresets ?? {}) };
    delete nextPresets[selectedPreset];
    delete nextAgentPresets[selectedPreset];
    const nextDefault = routing.defaultPreset === selectedPreset ? Object.keys(nextPresets)[0] : routing.defaultPreset;
    setSelectedPreset(nextDefault);
    void saveRouting({ ...routing, defaultPreset: nextDefault, presets: nextPresets, agentPresets: nextAgentPresets }, `Preset ${selectedPreset} verwijderd`);
  };

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div>
          <h3 className="card-title">Oh-my agent presets</h3>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Visueel beheer van model, variant, skills en MCPs per preset.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={addPreset}>Add preset</button>
          <button type="button" className="btn btn-danger" onClick={deletePreset} disabled={presetIds.length <= 1}>Delete preset</button>
        </div>
      </div>
      <div className="grid grid-3">
        <Field label="Preset">
          <select className="form-select" value={selectedPreset} onChange={(event) => setSelectedPreset(event.target.value)}>
            {presetIds.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </Field>
        <Field label="Name">
          <input className="form-input" value={selectedInfo.name ?? ''} onChange={(event) => updatePresetInfo({ name: event.target.value })} />
        </Field>
        <Field label="Description">
          <input className="form-input" value={selectedInfo.description ?? ''} onChange={(event) => updatePresetInfo({ description: event.target.value })} />
        </Field>
      </div>
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {agentIds.map((agentId) => {
          const agent = agents.find((item) => item.id === agentId);
          const config = selectedAgents[agentId] ?? { model: joinModelRef(agent?.primary.provider ?? '', agent?.primary.model ?? ''), variant: agent?.primary.variant, skills: [], mcps: [] };
          return (
            <div key={agentId} style={{ border: '1px solid var(--border-primary)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <strong>{agent?.displayName || agentId}</strong>
                <span className="badge badge-info">{agentId}</span>
              </div>
              <FullModelPicker providers={providers} value={config.model} variant={config.variant} onChange={(model, variant) => updateAgentPreset(agentId, { model, variant })} />
              <div className="grid grid-2" style={{ marginTop: 8 }}>
                <Field label="Skills">
                  <input className="form-input" value={csv(config.skills)} onChange={(event) => updateAgentPreset(agentId, { skills: fromCsv(event.target.value) })} />
                </Field>
                <Field label="MCPs">
                  <input className="form-input" value={csv(config.mcps)} onChange={(event) => updateAgentPreset(agentId, { mcps: fromCsv(event.target.value) })} />
                </Field>
              </div>
            </div>
          );
        })}
      </div>
      {message && <div style={{ color: 'var(--accent-success)', fontSize: 13, marginTop: 12 }}>{message}</div>}
      {error && <div style={{ color: 'var(--accent-error)', fontSize: 13, marginTop: 12 }}>{error}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  Agents page
// ══════════════════════════════════════════════════════════════════════
export function Agents() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [providersSource, setProvidersSource] = useState<ProvidersSourceConfig | null>(null);
  const [routing, setRouting] = useState<RoutingConfig | null>(null);
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
        setProvidersSource(configRes.data.providers);
        const r = configRes.data.routing as unknown as RoutingConfig;
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
    if (routing) {
      const nextRouting = { ...routing };
      if (updated) nextRouting.council = updated;
      else delete nextRouting.council;
      setRouting(nextRouting);
    }
  };

  if (error) {
    return <div className="empty-state"><div className="empty-state-icon">⚠️</div><p>{error}</p></div>;
  }

  return (
    <div>
      <datalist id="model-variant-options">
        {['default', 'low', 'medium', 'high', 'thinking-high'].map((variant) => <option key={variant} value={variant} />)}
      </datalist>

      <div className="page-section-header">
        <div>
          <h2 className="page-section-title">Model routing</h2>
          <p className="page-section-subtitle">Configureer defaults, variants en oh-my presets zonder Advanced JSON.</p>
        </div>
      </div>

      {routing && providersSource && (
        <RoutingDefaultsCard
          routing={routing}
          providersSource={providersSource}
          providers={providers}
          agents={agents}
          onSaved={(nextRouting, nextProvidersSource) => {
            setRouting(nextRouting);
            setProvidersSource(nextProvidersSource);
          }}
        />
      )}

      {routing && <AgentPresetRoutingCard routing={routing} providers={providers} agents={agents} onSaved={setRouting} />}

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
          providers={providers}
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
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, marginTop: 16 }}>Primary</h4>
            <ModelPicker providers={providers} value={editing.primary} onChange={(primary) => setEditing({ ...editing, primary })} />
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, marginTop: 16 }}>Fallback</h4>
            <ModelPicker providers={providers} value={editing.fallback} onChange={(fallback) => setEditing({ ...editing, fallback })} />
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
