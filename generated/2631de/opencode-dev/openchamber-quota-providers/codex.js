import {
  buildResult,
  toUsageWindow
} from '../utils/index.js';

export const providerId = 'codex';
export const providerName = 'Codex';
export const aliases = ['openai', 'codex', 'chatgpt', 'codexlb'];

const CODEXLB_USAGE_URL = process.env.CODEXLB_USAGE_URL || 'http://codex-lb:2455/api/usage/summary';

function toMillis(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toUsedPercent(remainingPercent) {
  if (typeof remainingPercent !== 'number') return null;
  return Math.max(0, Math.min(100, 100 - remainingPercent));
}

function toWindow(window, fallbackKey) {
  if (!window || typeof window !== 'object') return null;
  const usedPercent = toUsedPercent(window.remainingPercent);
  const windowSeconds = typeof window.windowMinutes === 'number' ? window.windowMinutes * 60 : null;
  const resetAt = toMillis(window.resetAt);
  return {
    key: fallbackKey,
    value: toUsageWindow({
      usedPercent,
      windowSeconds,
      resetAt,
      valueLabel:
        typeof window.remainingCredits === 'number' && typeof window.capacityCredits === 'number'
          ? `${window.remainingCredits.toFixed(1)} / ${window.capacityCredits.toFixed(1)} credits left`
          : null
    })
  };
}

export const isConfigured = () => Boolean(process.env.CODEXLB_API_KEY || process.env.CODEXLB_USAGE_URL);

export const fetchQuota = async () => {
  if (!isConfigured()) {
    return buildResult({
      providerId,
      providerName,
      ok: false,
      configured: false,
      error: 'Not configured'
    });
  }

  try {
    const response = await fetch(CODEXLB_USAGE_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return buildResult({
        providerId,
        providerName,
        ok: false,
        configured: true,
        error: `API error: ${response.status}`
      });
    }

    const payload = await response.json();
    const windows = {};
    const primary = toWindow(payload?.primaryWindow, '5h');
    const secondary = toWindow(payload?.secondaryWindow, 'weekly');
    if (primary) windows[primary.key] = primary.value;
    if (secondary) windows[secondary.key] = secondary.value;

    return buildResult({
      providerId,
      providerName,
      ok: true,
      configured: true,
      usage: { windows }
    });
  } catch (error) {
    return buildResult({
      providerId,
      providerName,
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : 'Request failed'
    });
  }
};
