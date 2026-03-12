import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { lookupSecret, storeSecret, clearSecret } from './secrets.js';
import { requestJson, requestText } from './http.js';

const CODEX_AUTH_PROVIDER = 'codex-auth';
const CODEX_AUTH_LABEL = 'AI Usage Codex Auth';
const CODEX_ISSUER = 'https://auth.openai.com';
const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const DEVICE_CODE_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_SKEW_MS = 60 * 1000;

function stringOrNull(value) {
  const text = `${value ?? ''}`.trim();
  return text || null;
}

function parseJsonText(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch (e) {
    return null;
  }
}

function parseJwtPayload(token) {
  const text = stringOrNull(token);
  if (!text)
    return null;

  const parts = text.split('.');
  if (parts.length < 2)
    return null;

  let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  while ((base64.length % 4) !== 0)
    base64 += '=';

  try {
    const bytes = GLib.base64_decode(base64);
    return parseJsonText(new TextDecoder('utf-8').decode(bytes));
  } catch (e) {
    return null;
  }
}

function extractCodexClaims(token) {
  const payload = parseJwtPayload(token);
  const authClaims = payload?.['https://api.openai.com/auth'];
  if (!authClaims || typeof authClaims !== 'object')
    return { payload, authClaims: null };
  return { payload, authClaims };
}

function buildFormBody(fields) {
  return Object.entries(fields)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(`${value}`)}`)
    .join('&');
}

function buildCodexAuthRecord({ accessToken, refreshToken, idToken = null } = {}) {
  const access = stringOrNull(accessToken);
  const refresh = stringOrNull(refreshToken);
  const id = stringOrNull(idToken);

  if (!access || !refresh)
    return null;

  const { payload, authClaims } = extractCodexClaims(id ?? access);
  const accessPayload = parseJwtPayload(access);
  const exp = Number(accessPayload?.exp ?? payload?.exp ?? null);

  return {
    accessToken: access,
    refreshToken: refresh,
    idToken: id,
    accountId: stringOrNull(authClaims?.chatgpt_account_id ?? null),
    planType: stringOrNull(authClaims?.chatgpt_plan_type ?? null),
    expiresAtMs: Number.isFinite(exp) ? exp * 1000 : null,
    storedAtMs: Date.now(),
  };
}

function parseDeviceCodeResponse(json) {
  if (!json || typeof json !== 'object')
    return null;

  const deviceAuthId = stringOrNull(json.device_auth_id ?? json.deviceAuthId ?? null);
  const userCode = stringOrNull(json.user_code ?? json.usercode ?? json.userCode ?? null);
  const interval = Number.parseInt(`${json.interval ?? ''}`, 10);
  if (!deviceAuthId || !userCode)
    return null;

  return {
    deviceAuthId,
    userCode,
    intervalSeconds: Number.isFinite(interval) && interval > 0 ? interval : 5,
    verificationUrl: `${CODEX_ISSUER}/codex/device`,
    expiresAtMs: Date.now() + DEVICE_CODE_MAX_AGE_MS,
  };
}

function parseDeviceTokenResponse(json) {
  if (!json || typeof json !== 'object')
    return null;

  const authorizationCode = stringOrNull(json.authorization_code ?? json.authorizationCode ?? null);
  const codeVerifier = stringOrNull(json.code_verifier ?? json.codeVerifier ?? null);
  if (!authorizationCode || !codeVerifier)
    return null;

  return {
    authorizationCode,
    codeVerifier,
  };
}

function parseTokenResponse(text) {
  const json = parseJsonText(text);
  if (!json || typeof json !== 'object')
    return null;

  return {
    accessToken: stringOrNull(json.access_token ?? json.accessToken ?? null),
    refreshToken: stringOrNull(json.refresh_token ?? json.refreshToken ?? null),
    idToken: stringOrNull(json.id_token ?? json.idToken ?? null),
  };
}

export function parseCodexAuthSecret(secret) {
  const json = parseJsonText(secret);
  if (!json || typeof json !== 'object')
    return null;

  return buildCodexAuthRecord({
    accessToken: json.accessToken,
    refreshToken: json.refreshToken,
    idToken: json.idToken,
  });
}

export async function loadCodexAuth() {
  const secret = await lookupSecret(CODEX_AUTH_PROVIDER);
  return parseCodexAuthSecret(secret);
}

export async function storeCodexAuth(record) {
  const normalized = buildCodexAuthRecord(record);
  if (!normalized)
    throw new Error('Invalid Codex auth payload');

  await storeSecret(CODEX_AUTH_PROVIDER, JSON.stringify(normalized), CODEX_AUTH_LABEL);
  return normalized;
}

export async function clearCodexAuth() {
  await clearSecret(CODEX_AUTH_PROVIDER);
}

export async function requestCodexDeviceCode({ requestJsonFn = requestJson, cancellable = null } = {}) {
  let response;
  try {
    response = await requestJsonFn({
      method: 'POST',
      url: `${CODEX_ISSUER}/api/accounts/deviceauth/usercode`,
      headers: {
        'Accept': 'application/json',
      },
      body: JSON.stringify({ client_id: CODEX_CLIENT_ID }),
      cancellable,
    });
  } catch (e) {
    return { ok: false, errorKind: 'network' };
  }

  if (!response.ok)
    return { ok: false, errorKind: response.status === 404 ? 'unsupported' : 'http', status: response.status };

  const deviceCode = parseDeviceCodeResponse(response.json);
  if (!deviceCode)
    return { ok: false, errorKind: 'parse' };

  return {
    ok: true,
    ...deviceCode,
  };
}

export async function pollCodexDeviceCode({
  deviceAuthId,
  userCode,
  requestJsonFn = requestJson,
  cancellable = null,
} = {}) {
  let response;
  try {
    response = await requestJsonFn({
      method: 'POST',
      url: `${CODEX_ISSUER}/api/accounts/deviceauth/token`,
      headers: {
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        device_auth_id: deviceAuthId,
        user_code: userCode,
      }),
      cancellable,
    });
  } catch (e) {
    return { ok: false, errorKind: 'network' };
  }

  if (!response.ok) {
    if (response.status === 403 || response.status === 404)
      return { ok: false, errorKind: 'pending', status: response.status };
    return { ok: false, errorKind: 'http', status: response.status };
  }

  const tokenData = parseDeviceTokenResponse(response.json);
  if (!tokenData)
    return { ok: false, errorKind: 'parse' };

  return {
    ok: true,
    ...tokenData,
  };
}

export async function exchangeCodexAuthorizationCode({
  authorizationCode,
  codeVerifier,
  requestTextFn = requestText,
  cancellable = null,
} = {}) {
  let response;
  try {
    response = await requestTextFn({
      method: 'POST',
      url: `${CODEX_ISSUER}/oauth/token`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildFormBody({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: `${CODEX_ISSUER}/deviceauth/callback`,
        client_id: CODEX_CLIENT_ID,
        code_verifier: codeVerifier,
      }),
      contentType: 'application/x-www-form-urlencoded',
      cancellable,
    });
  } catch (e) {
    return { ok: false, errorKind: 'network' };
  }

  if (response.status < 200 || response.status >= 300)
    return { ok: false, errorKind: 'http', status: response.status };

  const tokens = parseTokenResponse(response.text);
  const auth = buildCodexAuthRecord(tokens ?? {});
  if (!auth)
    return { ok: false, errorKind: 'parse' };

  await storeCodexAuth(auth);
  return { ok: true, auth };
}

export async function refreshCodexAuth({
  auth = null,
  requestTextFn = requestText,
  cancellable = null,
} = {}) {
  const current = auth ?? await loadCodexAuth();
  if (!current?.refreshToken)
    return { ok: false, errorKind: 'not_configured' };

  let response;
  try {
    response = await requestTextFn({
      method: 'POST',
      url: `${CODEX_ISSUER}/oauth/token`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildFormBody({
        client_id: CODEX_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
      }),
      contentType: 'application/x-www-form-urlencoded',
      cancellable,
    });
  } catch (e) {
    return { ok: false, errorKind: 'network' };
  }

  if (response.status < 200 || response.status >= 300)
    return { ok: false, errorKind: response.status === 401 ? 'auth' : 'http', status: response.status };

  const refreshed = parseTokenResponse(response.text);
  const merged = buildCodexAuthRecord({
    accessToken: refreshed?.accessToken ?? current.accessToken,
    refreshToken: refreshed?.refreshToken ?? current.refreshToken,
    idToken: refreshed?.idToken ?? current.idToken,
  });
  if (!merged)
    return { ok: false, errorKind: 'parse' };

  await storeCodexAuth(merged);
  return { ok: true, auth: merged };
}

export async function lookupCodexAccessToken({
  requestTextFn = requestText,
  cancellable = null,
} = {}) {
  const auth = await loadCodexAuth();
  if (!auth)
    return null;

  if (Number.isFinite(auth.expiresAtMs) && auth.expiresAtMs <= Date.now() + REFRESH_SKEW_MS) {
    const refreshed = await refreshCodexAuth({ auth, requestTextFn, cancellable });
    if (refreshed.ok)
      return refreshed.auth.accessToken;
  }

  return auth.accessToken;
}

export function buildCodexStatus(auth) {
  if (!auth)
    return 'Not connected';

  const plan = auth.planType ?? 'unknown';
  if (auth.accountId)
    return `Connected (${plan}, ${auth.accountId})`;
  return `Connected (${plan})`;
}

export function canOpenUris() {
  return typeof Gio.AppInfo.launch_default_for_uri === 'function';
}

export function openCodexVerificationUrl(url) {
  Gio.AppInfo.launch_default_for_uri(url, null);
}
