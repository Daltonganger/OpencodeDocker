import type { ProviderEntry, ProviderModel } from '../types/index.js';
import * as files from './files.js';

type OpenAIModelsResponse = {
  data?: Array<Record<string, unknown>>;
};

type ProviderModelsPayload = OpenAIModelsResponse | Array<Record<string, unknown>>;

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function prettifyModelName(id: string): string {
  return id
    .replaceAll(/[-_]+/g, ' ')
    .replaceAll(/\b\w/g, (char) => char.toUpperCase());
}

function inferCapabilities(model: Record<string, unknown>, fallbackId: string): string[] {
  const blob = JSON.stringify(model).toLowerCase();
  const caps = new Set<string>();

  if (/reason|thinking|claude|gpt-5|gpt-4|glm-4\.[67]|sonnet|opus/.test(blob)) caps.add('reasoning');
  if (/code|coder|program|dev|software/.test(blob)) caps.add('code');
  if (/mini|small|air|flash|fast|nano/.test(blob)) caps.add('fast');
  if (/mini|small|air|flash|budget|cheap|econom/.test(blob)) caps.add('budget');
  if (/vision|image|multimodal/.test(blob)) caps.add('multimodal');
  if (!caps.size) {
    if (/glm|claude|gpt|llama|gemini/.test(fallbackId.toLowerCase())) caps.add('reasoning');
    else caps.add('general');
  }

  return [...caps];
}

function inferProviderModelLimit(provider: ProviderEntry, item: Record<string, unknown>, existing?: ProviderModel): ProviderModel['limit'] {
  if (existing?.limit?.context || existing?.limit?.output) {
    return { ...existing.limit };
  }

  const metadata = readRecord(item.metadata);
  const limit = {
    context:
      readNumber(item.context_length) ??
      readNumber(item.context_window) ??
      readNumber(metadata?.context_length) ??
      readNumber(metadata?.context_window) ??
      readNumber(item.tested_context_in_tokens) ??
      readNumber(metadata?.tested_context_in_tokens),
    output:
      readNumber(item.max_output_tokens) ??
      readNumber(metadata?.max_output_tokens) ??
      readNumber(item.output_tokens) ??
      readNumber(metadata?.output_tokens) ??
      readNumber(item.tested_context_out_tokens) ??
      readNumber(metadata?.tested_context_out_tokens),
  };

  const modelId = typeof item.id === 'string' ? item.id : '';

  if (!limit.context || !limit.output) {
    if (provider.id === 'codexlb') {
      limit.context ??= 272000;
      limit.output ??= 8192;
    }

    if (provider.id === 'chat2631') {
      limit.context ??= 128000;
      limit.output ??= 8192;
    }

    if (provider.id === 'nanogpt') {
      if (modelId === 'auto-model-basic') {
        limit.context ??= 131072;
        limit.output ??= 8192;
      } else if (modelId === 'auto-model-standard' || modelId === 'auto-model-premium' || modelId === 'auto-model') {
        limit.context ??= 262144;
        limit.output ??= 16384;
      } else {
        limit.context ??= 131072;
        limit.output ??= 8192;
      }
    }

    if (provider.id === 'kilo') {
      limit.context ??= 128000;
      limit.output ??= limit.context ?? 8192;
    }

    if (provider.id === 'openrouter') {
      limit.context ??= 128000;
      limit.output ??= 8192;
    }

    limit.context ??= 128000;
    limit.output ??= 8192;
  }

  return limit.context || limit.output ? limit : undefined;
}

function toProviderModel(provider: ProviderEntry, item: Record<string, unknown>, existing?: ProviderModel): ProviderModel | null {
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  if (!id) return null;
  const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : prettifyModelName(id);
  const limit = inferProviderModelLimit(provider, item, existing);
  return {
    id,
    name,
    capabilities: existing?.capabilities?.length ? existing.capabilities : inferCapabilities(item, id),
    ...(existing?.recommended ? { recommended: true } : {}),
    ...(existing?.visibleInOpencode ? { visibleInOpencode: true } : {}),
    ...(limit ? { limit } : {}),
    ...(existing?.pricing ? { pricing: { ...existing.pricing } } : {}),
    metadata: { ...(existing?.metadata ?? {}), source: 'sync' },
  };
}

function getModelsUrl(provider: ProviderEntry): string {
  return `${provider.baseUrl.replace(/\/$/, '')}/models`;
}

function getProviderHeaders(provider: ProviderEntry, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (provider.id === 'github') {
    headers['User-Agent'] = 'GitHubCopilotChat/0.26.7';
    headers['Editor-Version'] = 'vscode/1.96.2';
    headers['Editor-Plugin-Version'] = 'copilot-chat/0.26.7';
    headers['Openai-Organization'] = 'github-copilot';
    headers['Openai-Intent'] = 'conversation-panel';
    headers['X-GitHub-Api-Version'] = '2023-07-07';
  }
  return headers;
}

function extractModelItems(payload: ProviderModelsPayload): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function syncProviderModels(providerId: string) {
  const [source, envEntries] = await Promise.all([files.getProvidersSource(), files.readEnvFile()]);
  const provider = source.providers.find((item) => item.id === providerId);
  if (!provider) throw new Error('Provider not found');

  if (!['openai', 'openai-compatible'].includes(provider.type)) {
    throw new Error(`Live model sync is not supported for provider type '${provider.type}'`);
  }

  const apiKey = envEntries[provider.secretRef] ?? '';

  const response = await fetch(getModelsUrl(provider), { headers: getProviderHeaders(provider, apiKey) });

  const text = await response.text();
  if (!response.ok) throw new Error(`Model sync failed (${response.status}): ${text.slice(0, 400)}`);

  const payload = JSON.parse(text) as ProviderModelsPayload;
  const modelItems = extractModelItems(payload);
  if (!modelItems.length) throw new Error('Provider model catalog response contained no usable models');

  const existingById = new Map(provider.models.map((model) => [model.id, model]));
  const syncedModels = modelItems
    .map((item) => toProviderModel(provider, item, typeof item.id === 'string' ? existingById.get(item.id) : undefined))
    .filter((item): item is ProviderModel => Boolean(item))
    .sort((a, b) => a.name.localeCompare(b.name));

  const manualModels = provider.models
    .filter((model) => model.metadata?.manual === true && !syncedModels.some((synced) => synced.id === model.id))
    .map((model) => ({ ...model, metadata: { ...(model.metadata ?? {}), manual: true, source: 'manual' } }));

  const models = [...syncedModels, ...manualModels];

  if (!models.length) throw new Error('Provider /models response returned no usable models');

  const updated: ProviderEntry = {
    ...provider,
    models,
    defaultModel: models.some((model) => model.id === provider.defaultModel) ? provider.defaultModel : models[0].id,
    metadata: {
      ...(provider.metadata ?? {}),
      syncSource: getModelsUrl(provider),
      syncedAt: new Date().toISOString(),
      syncedCount: models.length,
    },
  };

  source.providers = source.providers.map((item) => (item.id === provider.id ? updated : item));
  await files.saveProvidersSource(source);

  return {
    provider: updated,
    syncedCount: models.length,
    sourceUrl: getModelsUrl(provider),
  };
}
