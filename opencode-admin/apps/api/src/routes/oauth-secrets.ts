import fs from 'fs/promises';
import type { FastifyPluginAsync } from 'fastify';
import * as files from '../services/files.js';
import { config } from '../services/config.js';
import type { OAuthStatusEntry } from '../types/index.js';

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function getAppOrigin(): string {
  try {
    return new URL(config.appBaseUrl).origin;
  } catch {
    return config.appBaseUrl.replace(/\/$/, '');
  }
}

function getDirectLoginPath(providerId: string, provider: { metadata?: Record<string, unknown> }): string | undefined {
  if (providerId === 'github') return '/copilot-auth/';
  const directLoginPath = provider.metadata?.directLoginPath;
  return typeof directLoginPath === 'string' && directLoginPath.length > 0 ? directLoginPath : undefined;
}

async function buildOAuthRuntimeDetails(providerId: string, status: { connected: boolean }) {
  if (providerId === 'github') {
    const authJson = await readJsonFile<Record<string, { accountId?: string } | undefined>>(config.targetAuthJsonPath, {});
    const github = authJson.github;
    const connected = Boolean(github) || status.connected;
    return {
      connected,
      accountCount: connected ? 1 : 0,
      accountSummary: connected
        ? github?.accountId
          ? `GitHub login actief (${github.accountId})`
          : 'GitHub login opgeslagen in OpenCode'
        : 'Nog geen GitHub login opgeslagen',
    };
  }

  if (providerId === 'google') {
    const antigravity = await readJsonFile<{ accounts?: Array<{ email?: string; enabled?: boolean }> }>(config.targetAntigravityAccountsPath, { accounts: [] });
    const enabledAccounts = (antigravity.accounts ?? []).filter((entry) => entry.enabled !== false);
    const connected = enabledAccounts.length > 0 || status.connected;
    return {
      connected,
      accountCount: enabledAccounts.length,
      accountSummary: enabledAccounts.length === 0
        ? 'Nog geen Google accounts in Antigravity pool'
        : enabledAccounts.length === 1
          ? `1 Google account in Antigravity pool`
          : `${enabledAccounts.length} Google accounts in Antigravity pool`,
    };
  }

  if (providerId === 'qwen') {
    const authJson = await readJsonFile<Record<string, { accountId?: string } | undefined>>(config.targetAuthJsonPath, {});
    const qwen = authJson['qwen-code'];
    const connected = Boolean(qwen) || status.connected;
    return {
      connected,
      accountCount: connected ? 1 : 0,
      accountSummary: connected ? 'Qwen login opgeslagen als actief profiel' : 'Nog geen Qwen login opgeslagen',
    };
  }

  return {
    connected: status.connected,
    accountCount: status.connected ? 1 : 0,
    accountSummary: status.connected ? 'OAuth login actief' : 'Nog geen OAuth login opgeslagen',
  };
}

export const oauthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    const [source, envEntries] = await Promise.all([files.getOAuthSource(), files.readEnvFile()]);
    const appOrigin = getAppOrigin();
    const data: OAuthStatusEntry[] = await Promise.all(Object.entries(source.providers).map(async ([id, provider]) => {
      const runtimeManagedAuth = provider.metadata?.runtimeManagedAuth === true;
      const status = source.status[id] ?? {
        configured: false,
        connected: false,
        lastChecked: null,
        tokenExpiry: null,
        error: null,
      };
      const runtime = await buildOAuthRuntimeDetails(id, status);
      const directLoginPath = getDirectLoginPath(id, provider);
      const configured = runtimeManagedAuth || Boolean(
        provider.clientIdRef
        && provider.clientSecretRef
        && envEntries[provider.clientIdRef]
        && envEntries[provider.clientSecretRef]
      );
      const loginMode = directLoginPath ? 'direct' : undefined;
      const loginUrl = loginMode === 'direct'
        ? `${appOrigin}${directLoginPath}`
        : undefined;
      const loginEnabled = provider.enabled && configured;
      return {
        id,
        displayName: provider.displayName,
        enabled: provider.enabled,
        clientIdRef: provider.clientIdRef,
        clientSecretRef: provider.clientSecretRef,
        scopes: provider.scopes,
        callbackPath: provider.callbackPath,
        callbackUrl: provider.callbackPath ? `${config.appBaseUrl}${provider.callbackPath}` : undefined,
        configured,
        connected: runtime.connected,
        lastChecked: status.lastChecked,
        tokenExpiry: status.tokenExpiry,
        error: status.error,
        accountCount: runtime.accountCount,
        accountSummary: runtime.accountSummary,
        loginUrl,
        loginLabel:
          id === 'google'
            ? (runtime.accountCount ?? 0) > 0 ? 'Add Google account' : 'Login with Google'
            : id === 'github'
              ? 'Login with GitHub'
              : id === 'qwen'
                ? 'Login with Qwen'
                : 'Open login',
        loginEnabled,
        loginMode,
        metadata: provider.metadata,
      };
    }));
    return { success: true, data };
  });

  fastify.patch<{ Params: { id: string }; Body: Partial<{ enabled: boolean; scopes: string[]; callbackPath: string }> }>('/:id', async (request, reply) => {
    const source = await files.getOAuthSource();
    const entry = source.providers[request.params.id];
    if (!entry) return reply.status(404).send({ success: false, error: 'OAuth provider not found' });
    source.providers[request.params.id] = {
      ...entry,
      ...request.body,
    };
    await files.saveOAuthSource(source);
    return { success: true, data: source.providers[request.params.id] };
  });
};

export const secretsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => ({ success: true, data: await files.getSecretStatuses() }));

  fastify.post<{ Body: { key: string; value: string } }>('/', async (request, reply) => {
    const registeredKeys = await files.getRegisteredSecretKeys();
    if (!registeredKeys.has(request.body.key)) {
      return reply.status(404).send({ success: false, error: 'Secret key not registered' });
    }
    const status = await files.setSecretValue(request.body.key, request.body.value);
    if (!status) return reply.status(404).send({ success: false, error: 'Secret key not registered' });
    return { success: true, data: status };
  });

  fastify.delete<{ Params: { key: string } }>('/:key', async (request, reply) => {
    const registeredKeys = await files.getRegisteredSecretKeys();
    if (!registeredKeys.has(request.params.key)) {
      return reply.status(404).send({ success: false, error: 'Secret key not registered' });
    }
    const deleted = await files.deleteSecretValue(request.params.key);
    if (!deleted) return reply.status(404).send({ success: false, error: 'Secret not found in target env file' });
    return { success: true, data: { key: request.params.key } };
  });
};
