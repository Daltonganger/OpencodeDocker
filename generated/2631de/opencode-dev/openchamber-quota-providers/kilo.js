import { readAuthFile } from '../../opencode/auth.js';
import {
  getAuthEntry,
  normalizeAuthEntry,
  buildResult,
  toUsageWindow,
  formatMoney
} from '../utils/index.js';

export const providerId = 'kilo';
export const providerName = 'Kilo';
export const aliases = ['kilo', 'kilo-gateway', 'kilocode'];

function resolveApiKey() {
  const auth = readAuthFile();
  const entry = normalizeAuthEntry(getAuthEntry(auth, aliases));
  return entry?.key ?? entry?.token ?? process.env.KILO_GATEWAY_API_KEY ?? null;
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
    const response = await fetch('https://api.kilo.ai/api/profile/balance', {
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
    const balance = typeof payload?.balance === 'number' ? payload.balance : null;
    const isDepleted = payload?.isDepleted === true;
    const windows = {
      credits: toUsageWindow({
        usedPercent: isDepleted ? 100 : balance !== null ? 0 : null,
        windowSeconds: null,
        resetAt: null,
        valueLabel: balance !== null ? `$${formatMoney(balance)} remaining` : isDepleted ? 'Depleted' : 'Balance unavailable'
      })
    };

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
