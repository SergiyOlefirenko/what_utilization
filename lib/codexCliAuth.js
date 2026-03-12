import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { CODEX_PROVIDER } from './providers/codex.js';

function normalizeAuthMode(value) {
  const text = `${value ?? ''}`.trim();
  if (!text)
    return null;
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function stringOrNull(value) {
  const text = `${value ?? ''}`.trim();
  return text || null;
}

export function getCodexCliAuthFilePath(homeDir = GLib.get_home_dir()) {
  return GLib.build_filenamev([homeDir, '.codex', 'auth.json']);
}

export function parseCodexCliAuthJson(json) {
  if (!json || typeof json !== 'object')
    return { ok: false, errorKind: 'parse' };

  const authMode = normalizeAuthMode(json.auth_mode ?? json.authMode ?? null);
  const hasApiKey = Boolean(stringOrNull(json.OPENAI_API_KEY ?? json.openai_api_key ?? json.openaiApiKey ?? null));

  if (authMode === 'apikey' || authMode === 'api' || (!authMode && hasApiKey)) {
    return {
      ok: false,
      errorKind: 'unsupported_auth_mode',
      authMode: authMode ?? 'apikey',
    };
  }

  if (authMode && authMode !== 'chatgpt' && authMode !== 'chatgptauthtokens') {
    return {
      ok: false,
      errorKind: 'unsupported_auth_mode',
      authMode,
    };
  }

  const tokens = json.tokens && typeof json.tokens === 'object' ? json.tokens : null;
  const accessToken = stringOrNull(tokens?.access_token ?? tokens?.accessToken ?? null);
  const accountId = stringOrNull(
    tokens?.account_id
    ?? tokens?.accountId
    ?? tokens?.id_token?.chatgpt_account_id
    ?? tokens?.idToken?.chatgptAccountId
    ?? null
  );

  if (!accessToken) {
    return {
      ok: false,
      errorKind: 'not_logged_in',
      authMode: authMode ?? 'chatgpt',
    };
  }

  return {
    ok: true,
    authMode: authMode ?? 'chatgpt',
    accessToken,
    accountId,
  };
}

export function resolveCodexAuthState({ cliAuth, fallbackToken = null, codexInstalled = true } = {}) {
  if (cliAuth?.ok) {
    return {
      ok: true,
      source: 'cli',
      accessToken: cliAuth.accessToken,
      accountId: cliAuth.accountId ?? null,
      path: cliAuth.path ?? null,
    };
  }

  if (fallbackToken) {
    return {
      ok: true,
      source: 'fallback',
      accessToken: fallbackToken,
      path: cliAuth?.path ?? null,
      cliErrorKind: cliAuth?.errorKind ?? null,
    };
  }

  let errorKind = cliAuth?.errorKind ?? 'not_found';
  if (errorKind === 'not_found' && !codexInstalled)
    errorKind = 'not_installed';

  return {
    ok: false,
    errorKind,
    path: cliAuth?.path ?? null,
    authMode: cliAuth?.authMode ?? null,
  };
}

export async function readCodexCliAuth({ homeDir = GLib.get_home_dir() } = {}) {
  const path = getCodexCliAuthFilePath(homeDir);
  const file = Gio.File.new_for_path(path);

  if (!file.query_exists(null))
    return { ok: false, errorKind: 'not_found', path };

  let text;
  try {
    const [, bytes] = file.load_contents(null);
    text = new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return { ok: false, errorKind: 'parse', path };
  }

  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    return { ok: false, errorKind: 'parse', path };
  }

  return {
    ...parseCodexCliAuthJson(json),
    path,
  };
}

export async function readCodexAuthState({
  homeDir = GLib.get_home_dir(),
  lookupFallbackToken = null,
} = {}) {
  const cliAuth = await readCodexCliAuth({ homeDir });

  if (cliAuth.ok) {
    return resolveCodexAuthState({
      cliAuth,
      fallbackToken: null,
      codexInstalled: true,
    });
  }

  let fallbackToken = null;

  if (typeof lookupFallbackToken === 'function') {
    try {
      fallbackToken = await lookupFallbackToken(CODEX_PROVIDER);
    } catch (e) {
      fallbackToken = null;
    }
  }

  return resolveCodexAuthState({
    cliAuth,
    fallbackToken,
    codexInstalled: Boolean(GLib.find_program_in_path('codex')),
  });
}

export async function lookupCodexAccessToken(opts = {}) {
  const state = await readCodexAuthState(opts);
  return state.ok ? state.accessToken : null;
}
