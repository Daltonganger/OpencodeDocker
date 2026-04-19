import { readAuthFile } from '../../opencode/auth.js';
import {
  getAuthEntry,
  normalizeAuthEntry,
  buildResult,
  toUsageWindow,
  toNumber,
  toTimestamp
} from '../utils/index.js';

const NANO_GPT_DAILY_WINDOW_SECONDS = 86400;

export const providerId = 'nano-gpt';
export const providerName = 'NanoGPT';
export const aliases = ['nano-gpt', 'nanogpt', 'nano_gpt'];

function resolveApiKey() {
  const auth = readAuthFile();
  const entry = normalizeAuthEntry(getAuthEntry(auth, aliases));
  return entry?.key ?? entry?.token ?? process.env.NANOGPT_API_KEY ?? null;
}

export const isConfigured = () => Boolean(resolveApiKey());

export const fetchQuota = async () => {
  const apiKey = resolveApiKey();

  if (!apiKey) {
    return buildResult({
      providerId,
      providerName,
      ok: false,
      configured: false,
      error: 'Not configured'
    });
  }

  try {
    const response = await fetch('https://nano-gpt.com/api/subscription/v1/usage', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
    const period = payload?.period ?? null;
    const daily = payload?.daily ?? payload?.dailyInputTokens ?? payload?.dailyImages ?? null;
    const weekly = payload?.weeklyInputTokens ?? null;
    const monthly = payload?.monthly ?? null;
    const state = payload?.state ?? payload?.providerStatus ?? 'active';

    if (daily) {
      let usedPercent = null;
      const percentUsed = daily?.percentUsed;
      if (typeof percentUsed === 'number') {
        usedPercent = Math.max(0, Math.min(100, percentUsed * 100));
      } else {
        const used = toNumber(daily?.used);
        const limit = toNumber(daily?.limit ?? daily?.total ?? daily?.limits?.daily);
        if (used !== null && limit !== null && limit > 0) {
          usedPercent = Math.max(0, Math.min(100, (used / limit) * 100));
        }
      }
      const resetAt = toTimestamp(daily?.resetAt);
      const valueLabel = state !== 'active' ? `(${state})` : null;
      windows.daily = toUsageWindow({
        usedPercent,
        windowSeconds: NANO_GPT_DAILY_WINDOW_SECONDS,
        resetAt,
        valueLabel
      });
    }

    if (weekly) {
      let usedPercent = null;
      const percentUsed = weekly?.percentUsed;
      if (typeof percentUsed === 'number') {
        usedPercent = Math.max(0, Math.min(100, percentUsed * 100));
      } else {
        const used = toNumber(weekly?.used);
        const limit = toNumber(weekly?.limit ?? payload?.limits?.weeklyInputTokens);
        if (used !== null && limit !== null && limit > 0) {
          usedPercent = Math.max(0, Math.min(100, (used / limit) * 100));
        }
      }
      const resetAt = toTimestamp(weekly?.resetAt);
      const limit = toNumber(payload?.limits?.weeklyInputTokens);
      const remaining = toNumber(weekly?.remaining);
      windows.weekly = toUsageWindow({
        usedPercent,
        windowSeconds: 604800,
        resetAt,
        valueLabel: limit !== null && remaining !== null ? `${remaining.toLocaleString()} / ${limit.toLocaleString()} tokens left` : null
      });
    }

    if (monthly) {
      let usedPercent = null;
      const percentUsed = monthly?.percentUsed;
      if (typeof percentUsed === 'number') {
        usedPercent = Math.max(0, Math.min(100, percentUsed * 100));
      } else {
        const used = toNumber(monthly?.used);
        const limit = toNumber(monthly?.limit ?? monthly?.monthlyInputTokens ?? monthly?.limits?.monthly);
        if (used !== null && limit !== null && limit > 0) {
          usedPercent = Math.max(0, Math.min(100, (used / limit) * 100));
        }
      }
      const resetAt = toTimestamp(monthly?.resetAt ?? period?.currentPeriodEnd);
      const valueLabel = state !== 'active' ? `(${state})` : null;
      windows.monthly = toUsageWindow({
        usedPercent,
        windowSeconds: null,
        resetAt,
        valueLabel
      });
    }

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
