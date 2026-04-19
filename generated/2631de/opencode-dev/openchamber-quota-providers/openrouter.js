import { readAuthFile } from '../../opencode/auth.js';
import {
  getAuthEntry,
  normalizeAuthEntry,
  buildResult,
  toUsageWindow,
  toNumber,
  formatMoney
} from '../utils/index.js';

export const providerId = 'openrouter';
export const providerName = 'OpenRouter';
export const aliases = ['openrouter'];

function resolveApiKey() {
  const auth = readAuthFile();
  const entry = normalizeAuthEntry(getAuthEntry(auth, aliases));
  return entry?.key ?? entry?.token ?? process.env.OPENROUTER_API_KEY ?? null;
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
    const response = await fetch('https://openrouter.ai/api/v1/credits', {
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
    const credits = payload?.data ?? {};
    const totalCredits = toNumber(credits.total_credits);
    const totalUsage = toNumber(credits.total_usage);
    const remaining = totalCredits !== null && totalUsage !== null
      ? Math.max(0, totalCredits - totalUsage)
      : null;
    const usedPercent = totalCredits && totalUsage !== null
      ? Math.max(0, Math.min(100, (totalUsage / totalCredits) * 100))
      : null;

    return buildResult({
      providerId,
      providerName,
      ok: true,
      configured: true,
      usage: {
        windows: {
          credits: toUsageWindow({
            usedPercent,
            windowSeconds: null,
            resetAt: null,
            valueLabel: remaining !== null ? `$${formatMoney(remaining)} remaining` : null
          })
        }
      }
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
