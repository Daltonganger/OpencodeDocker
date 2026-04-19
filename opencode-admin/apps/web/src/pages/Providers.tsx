import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProviders, syncProviderModels, toggleProvider, updateProvider } from '@/api';
import type { ProviderConfig, ProviderModel } from '@/types';
import { Modal } from '@/components/Modal';

const emptyManualModel = (): ProviderModel => ({ id: '', name: '', capabilities: [], metadata: { manual: true, source: 'manual' } });

type FlashMessage = {
  text: string;
  tone: 'success' | 'warning' | 'error' | 'info';
};

type ModelFilter = 'important' | 'opencode' | 'manual' | 'all';

function isManualModel(model: ProviderModel) {
  return model.metadata?.manual === true || model.metadata?.source === 'manual';
}

export function Providers() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [editing, setEditing] = useState<ProviderConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<FlashMessage | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [manualModelDraft, setManualModelDraft] = useState<ProviderModel>(emptyManualModel());
  const [modelQuery, setModelQuery] = useState('');
  const [modelFilter, setModelFilter] = useState<ModelFilter>('important');
  const [showAllModels, setShowAllModels] = useState(false);

  const modelStats = useMemo(() => {
    if (!editing) {
      return { total: 0, recommended: 0, manual: 0, synced: 0 };
    }

    const manual = editing.models.filter((model) => isManualModel(model)).length;
    const recommended = editing.models.filter((model) => model.recommended).length;
    const visibleInOpencode = editing.models.filter((model) => model.visibleInOpencode).length;
    return {
      total: editing.models.length,
      recommended,
      visibleInOpencode,
      manual,
    };
  }, [editing]);

  const filteredModels = useMemo(() => {
    if (!editing) return [];

    const query = modelQuery.trim().toLowerCase();

    return editing.models.filter((model) => {
      const matchesFilter = modelFilter === 'all'
        ? true
        : modelFilter === 'opencode'
          ? model.visibleInOpencode === true
        : modelFilter === 'manual'
          ? isManualModel(model)
          : model.recommended || model.visibleInOpencode || isManualModel(model) || model.id === editing.defaultModel;

      const matchesQuery = !query || `${model.name} ${model.id} ${model.capabilities.join(' ')}`.toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    });
  }, [editing, modelFilter, modelQuery]);

  const visibleModels = showAllModels ? filteredModels : filteredModels.slice(0, 12);

  const loadProviders = useCallback(async () => {
    const response = await getProviders();
    setProviders(response.data);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadProviders();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load providers');
      }
    })();
  }, [loadProviders]);

  if (error) return <div className="empty-state"><div className="empty-state-icon">⚠️</div><p>{error}</p></div>;
  if (!providers.length) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Providers & Models</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Manage provider aliases, base URLs and default model catalogs. Sync from live APIs where supported, and use <strong>Providers JSON</strong> to supplement models manually.</p>
      </div>

      {message && <div className={`message-banner message-${message.tone}`} style={{ marginBottom: 16 }}>{message.text}</div>}

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Alias</th>
                <th>Type</th>
                <th>Catalog</th>
                <th>Default model</th>
                <th>Secret ref</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{provider.alias}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{provider.baseUrl}</div>
                  </td>
                  <td><span className="badge badge-info">{provider.type}</span></td>
                  <td>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ fontWeight: 600 }}>{provider.models.length} models</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {provider.models.filter((model) => model.recommended).length} important • {provider.models.filter((model) => model.visibleInOpencode).length} in OpenCode
                      </div>
                    </div>
                  </td>
                  <td><code>{provider.defaultModel}</code></td>
                  <td><code>{provider.secretRef}</code></td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={provider.enabled} onChange={async () => {
                         const response = await toggleProvider(provider.id, !provider.enabled);
                         setProviders((current) => current.map((item) => item.id === provider.id ? response.data : item));
                      }} />
                      <span className="toggle-slider"></span>
                    </label>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={syncingId === provider.id}
                        onClick={async () => {
                          try {
                            setSyncingId(provider.id);
                            const response = await syncProviderModels(provider.id);
                            setProviders((current) => current.map((item) => item.id === provider.id ? response.data.provider : item));
                            setMessage({ text: `Synced ${response.data.syncedCount} models from ${provider.name}`, tone: 'success' });
                          } catch (err) {
                            setMessage({ text: err instanceof Error ? err.message : 'Provider sync failed', tone: 'error' });
                          } finally {
                            setSyncingId(null);
                          }
                        }}
                      >
                        {syncingId === provider.id ? 'Syncing…' : 'Sync live models'}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => {
                        setEditing(structuredClone(provider));
                        setManualModelDraft(emptyManualModel());
                        setModelQuery('');
                        setModelFilter('important');
                        setShowAllModels(false);
                      }}>Edit</button>
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
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : 'Edit provider'}
        maxWidth={960}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={async () => {
              if (!editing) return;
              const response = await updateProvider(editing.id, editing);
              setProviders((current) => current.map((item) => item.id === editing.id ? response.data : item));
              setMessage({ text: `Saved ${response.data.name}`, tone: 'success' });
              setEditing(null);
            }}>Save</button>
          </>
        }
      >
        {editing && (
          <div>
            <Field label="Alias"><input className="form-input" value={editing.alias} onChange={(e) => setEditing({ ...editing, alias: e.target.value })} /></Field>
            <Field label="Base URL"><input className="form-input" value={editing.baseUrl} onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })} /></Field>
            <Field label="Default model">
              <select className="form-select" value={editing.defaultModel} onChange={(e) => setEditing({ ...editing, defaultModel: e.target.value })}>
                {editing.models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
            </Field>
            <Field label="Model catalog (read-only)">
              <div className="mini-stats-grid" style={{ marginBottom: 12 }}>
                <div className="mini-stat-card"><span className="mini-stat-label">Total</span><span className="mini-stat-value">{modelStats.total}</span></div>
                <div className="mini-stat-card"><span className="mini-stat-label">Important</span><span className="mini-stat-value">{modelStats.recommended}</span></div>
                <div className="mini-stat-card"><span className="mini-stat-label">OpenCode</span><span className="mini-stat-value">{modelStats.visibleInOpencode}</span></div>
                <div className="mini-stat-card"><span className="mini-stat-label">Manual</span><span className="mini-stat-value">{modelStats.manual}</span></div>
              </div>

              <details className="card card-collapsible nested-card">
                <summary className="card-header collapsible-summary">
                  <div>
                    <h3 className="card-title">Browse model catalog</h3>
                    <div className="section-description">Mark exactly which models OpenCode should show. If none are marked, OpenCode keeps showing the full provider catalog.</div>
                  </div>
                  <span className="badge badge-info">{filteredModels.length} shown</span>
                </summary>

                <div className="toolbar-row" style={{ marginBottom: 12 }}>
                  <input className="form-input" placeholder="Filter models by name, id or capability…" value={modelQuery} onChange={(e) => {
                    setModelQuery(e.target.value);
                    setShowAllModels(false);
                  }} />
                  <div className="segmented-control">
                    {[
                      { key: 'important', label: 'Important' },
                      { key: 'opencode', label: 'OpenCode' },
                      { key: 'manual', label: 'Manual' },
                      { key: 'all', label: 'All' },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={`segment-btn ${modelFilter === option.key ? 'active' : ''}`}
                        onClick={() => {
                          setModelFilter(option.key as ModelFilter);
                          setShowAllModels(false);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="model-list">
                  {visibleModels.map((model) => (
                    <div key={model.id} className="model-row">
                      <div className="model-row-main">
                        <div style={{ fontWeight: 600 }}>{model.name}</div>
                        <div className="model-row-id">{model.id}</div>
                        <div className="model-meta-row">
                          <button
                            type="button"
                            className={`toggle-chip ${model.recommended ? 'active' : ''}`}
                            onClick={() => setEditing(updateModel(editing, model.id, (current) => ({ ...current, recommended: !current.recommended })))}
                          >
                            Important
                          </button>
                          <button
                            type="button"
                            className={`toggle-chip ${model.visibleInOpencode ? 'active primary' : ''}`}
                            onClick={() => setEditing(updateModel(editing, model.id, (current) => ({ ...current, visibleInOpencode: !current.visibleInOpencode })))}
                          >
                            Show in OpenCode
                          </button>
                          <span className="price-pill">{formatPricing(model)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {model.id === editing.defaultModel && <span className="badge badge-success">Default</span>}
                          {model.capabilities.map((capability) => <span key={capability} className="badge badge-info">{capability}</span>)}
                          {model.recommended && <span className="badge badge-success">Recommended</span>}
                          {model.visibleInOpencode && <span className="badge badge-warning">Visible in OpenCode</span>}
                          <span className={`badge ${isManualModel(model) ? 'badge-warning' : 'badge-info'}`}>{isManualModel(model) ? 'Manual' : 'Synced'}</span>
                        </div>
                        <div className="price-editor-row">
                          <label className="price-field">
                            <span className="mini-stat-label">Input $ / 1M</span>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              step="0.001"
                              value={model.pricing?.input ?? ''}
                              onChange={(e) => setEditing(updateModel(editing, model.id, (current) => ({
                                ...current,
                                pricing: nextPricing(current.pricing, 'input', e.target.value),
                              })))}
                            />
                          </label>
                          <label className="price-field">
                            <span className="mini-stat-label">Output $ / 1M</span>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              step="0.001"
                              value={model.pricing?.output ?? ''}
                              onChange={(e) => setEditing(updateModel(editing, model.id, (current) => ({
                                ...current,
                                pricing: nextPricing(current.pricing, 'output', e.target.value),
                              })))}
                            />
                          </label>
                        </div>
                      </div>
                      {isManualModel(model) && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setEditing({ ...editing, models: editing.models.filter((item) => item.id !== model.id), defaultModel: editing.defaultModel === model.id ? editing.models.find((item) => item.id !== model.id)?.id ?? '' : editing.defaultModel })}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {!filteredModels.length && <div className="section-description">No models match this filter.</div>}

                <div className="section-description" style={{ marginTop: 12 }}>
                  Pricing is optional. Most provider `/models` endpoints do not expose pricing, so synced models often stay “unknown” unless you fill them in manually.
                </div>

                {filteredModels.length > 12 && (
                  <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setShowAllModels((current) => !current)}>
                    {showAllModels ? 'Show less' : `Show all ${filteredModels.length} models`}
                  </button>
                )}
              </details>

              <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 8 }}>
                Live sync merges with manual models. Synced models refresh from the provider API; manual models stay until you remove them.
              </div>
            </Field>
            <Field label="Add manual model">
              <div style={{ display: 'grid', gap: 10 }}>
                <input className="form-input" placeholder="Model ID (e.g. openai/gpt-5.4)" value={manualModelDraft.id} onChange={(e) => setManualModelDraft({ ...manualModelDraft, id: e.target.value })} />
                <input className="form-input" placeholder="Display name" value={manualModelDraft.name} onChange={(e) => setManualModelDraft({ ...manualModelDraft, name: e.target.value })} />
                <input className="form-input" placeholder="Capabilities comma-separated (e.g. reasoning, code, multimodal)" value={manualModelDraft.capabilities.join(', ')} onChange={(e) => setManualModelDraft({ ...manualModelDraft, capabilities: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={manualModelDraft.recommended === true} onChange={(e) => setManualModelDraft({ ...manualModelDraft, recommended: e.target.checked || undefined })} />
                  Mark as recommended
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={manualModelDraft.visibleInOpencode === true} onChange={(e) => setManualModelDraft({ ...manualModelDraft, visibleInOpencode: e.target.checked || undefined })} />
                  Show in OpenCode
                </label>
                <div className="price-editor-row">
                  <label className="price-field">
                    <span className="mini-stat-label">Input $ / 1M</span>
                    <input className="form-input" type="number" min="0" step="0.001" value={manualModelDraft.pricing?.input ?? ''} onChange={(e) => setManualModelDraft({ ...manualModelDraft, pricing: nextPricing(manualModelDraft.pricing, 'input', e.target.value) })} />
                  </label>
                  <label className="price-field">
                    <span className="mini-stat-label">Output $ / 1M</span>
                    <input className="form-input" type="number" min="0" step="0.001" value={manualModelDraft.pricing?.output ?? ''} onChange={(e) => setManualModelDraft({ ...manualModelDraft, pricing: nextPricing(manualModelDraft.pricing, 'output', e.target.value) })} />
                  </label>
                </div>
                <div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const id = manualModelDraft.id.trim();
                      const name = manualModelDraft.name.trim() || id;
                      if (!id) {
                        setMessage({ text: 'Manual model ID is required', tone: 'error' });
                        return;
                      }
                      if (editing.models.some((model) => model.id === id)) {
                        setMessage({ text: `Model '${id}' already exists for ${editing.name}`, tone: 'warning' });
                        return;
                      }
                      const nextModel: ProviderModel = {
                        id,
                        name,
                        capabilities: manualModelDraft.capabilities,
                        ...(manualModelDraft.recommended ? { recommended: true } : {}),
                        ...(manualModelDraft.visibleInOpencode ? { visibleInOpencode: true } : {}),
                        ...(manualModelDraft.pricing ? { pricing: manualModelDraft.pricing } : {}),
                        metadata: { ...(manualModelDraft.metadata ?? {}), manual: true, source: 'manual' },
                      };
                      setEditing({ ...editing, models: [...editing.models, nextModel], defaultModel: editing.defaultModel || id });
                      setManualModelDraft(emptyManualModel());
                      setMessage({ text: `Added manual model '${id}'`, tone: 'success' });
                    }}
                  >
                    Add manual model
                  </button>
                </div>
              </div>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><div className="form-label">{label}</div>{children}</div>;
}

function updateModel(editing: ProviderConfig, modelId: string, updater: (model: ProviderModel) => ProviderModel): ProviderConfig {
  return {
    ...editing,
    models: editing.models.map((model) => (model.id === modelId ? updater(model) : model)),
  };
}

function nextPricing(pricing: ProviderModel['pricing'], field: 'input' | 'output', rawValue: string): ProviderModel['pricing'] {
  const trimmed = rawValue.trim();
  const current = { ...(pricing ?? {}), currency: pricing?.currency ?? 'USD' };

  if (!trimmed) {
    delete current[field];
  } else {
    const parsed = Number(trimmed);
    current[field] = Number.isFinite(parsed) ? parsed : undefined;
  }

  if (current.input === undefined && current.output === undefined) {
    return undefined;
  }

  return current;
}

function formatPricing(model: ProviderModel): string {
  if (!model.pricing || (model.pricing.input === undefined && model.pricing.output === undefined)) {
    return 'Price unknown';
  }

  const currency = model.pricing.currency ?? 'USD';
  const input = model.pricing.input !== undefined ? model.pricing.input.toFixed(3) : '—';
  const output = model.pricing.output !== undefined ? model.pricing.output.toFixed(3) : '—';
  return `${currency} ${input} in / ${output} out per 1M`;
}
