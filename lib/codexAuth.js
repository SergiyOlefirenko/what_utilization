import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { lookupSecret, storeSecret, clearSecret } from './secrets.js';
import { requestText } from './http.js';

const CODEX_AUTH_PROVIDER = 'codex-auth';
const CODEX_AUTH_LABEL = 'AI Usage Codex Auth';
const CODEX_ISSUER = 'https://auth.openai.com';
const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const REFRESH_SKEW_MS = 60 * 1000;
const CODEX_ORIGINATOR = 'codex_cli_rs';
const OAUTH_SCOPE = 'openid profile email offline_access api.connectors.read api.connectors.invoke';

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

function randomUrlSafeToken() {
  return [GLib.uuid_string_random(), GLib.uuid_string_random(), GLib.uuid_string_random()]
    .join('')
    .replace(/-/g, '');
}

function base64UrlEncode(bytes) {
  return GLib.base64_encode(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2)
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

function createPkceCodes() {
  const codeVerifier = randomUrlSafeToken();
  const checksum = new GLib.Checksum(GLib.ChecksumType.SHA256);
  checksum.update(codeVerifier);
  const codeChallenge = base64UrlEncode(hexToBytes(checksum.get_string()));
  return { codeVerifier, codeChallenge };
}

function buildQueryString(fields) {
  return Object.entries(fields)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(`${value}`)}`)
    .join('&');
}

function buildAuthorizeUrl({ redirectUri, state, codeChallenge }) {
  const query = buildQueryString({
    response_type: 'code',
    client_id: CODEX_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: OAUTH_SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    state,
    originator: CODEX_ORIGINATOR,
  });
  return `${CODEX_ISSUER}/oauth/authorize?${query}`;
}

function buildHttpResponse(body, status = '200 OK') {
  const bytes = new TextEncoder().encode(body);
  return new TextEncoder().encode(
    `HTTP/1.1 ${status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${bytes.byteLength}\r\nConnection: close\r\n\r\n${body}`
  );
}

function writeHttpResponse(connection, body, status = '200 OK') {
  const output = connection.get_output_stream();
  output.write_all(buildHttpResponse(body, status), null);
  output.close(null);
}

function closeConnection(connection) {
  try {
    connection.close(null);
  } catch (e) {
  }
}

function parseCallbackRequest(connection) {
  const input = new Gio.DataInputStream({ base_stream: connection.get_input_stream() });
  const [requestLine] = input.read_line_utf8(null);
  if (!requestLine)
    return null;

  let line;
  do {
    [line] = input.read_line_utf8(null);
  } while (line !== null && line !== '');

  const match = requestLine.match(/^[A-Z]+\s+([^\s]+)\s+HTTP\//);
  if (!match)
    return null;

  const [path, query = ''] = match[1].split('?', 2);
  const params = {};
  for (const part of query.split('&')) {
    if (!part)
      continue;
    const [rawKey, rawValue = ''] = part.split('=', 2);
    params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
  }

  return { path, params };
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

export async function exchangeCodexAuthorizationCode({
  authorizationCode,
  codeVerifier,
  redirectUri,
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
        redirect_uri: redirectUri,
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

export function startCodexBrowserLogin({ requestTextFn = requestText } = {}) {
  const service = new Gio.SocketService();
  let port;
  try {
    port = service.add_any_inet_port(null);
  } catch (e) {
    return { ok: false, errorKind: 'network' };
  }

  const state = randomUrlSafeToken();
  const pkce = createPkceCodes();
  const redirectUri = `http://localhost:${port}/auth/callback`;
  const authUrl = buildAuthorizeUrl({ redirectUri, state, codeChallenge: pkce.codeChallenge });

  let settled = false;
  let incomingId = 0;
  let resolveCompletion;
  const completion = new Promise((resolve) => {
    resolveCompletion = resolve;
  });

  function finish(result) {
    if (settled)
      return;
    settled = true;
    if (incomingId)
      service.disconnect(incomingId);
    service.stop();
    resolveCompletion(result);
  }

  async function handleIncoming(connection) {
    const requestUrl = parseCallbackRequest(connection);
    if (!requestUrl || requestUrl.path !== '/auth/callback') {
      writeHttpResponse(connection, '<html><body>Not found</body></html>', '404 Not Found');
      closeConnection(connection);
      return;
    }

    if (requestUrl.params.state !== state) {
      writeHttpResponse(connection, '<html><body>State mismatch. You can close this tab.</body></html>', '400 Bad Request');
      closeConnection(connection);
      finish({ ok: false, errorKind: 'auth' });
      return;
    }

    const error = stringOrNull(requestUrl.params.error);
    if (error) {
      writeHttpResponse(connection, '<html><body>Sign-in failed. You can close this tab.</body></html>', '403 Forbidden');
      closeConnection(connection);
      finish({
        ok: false,
        errorKind: 'auth',
        error,
        description: stringOrNull(requestUrl.params.error_description),
      });
      return;
    }

    const authorizationCode = stringOrNull(requestUrl.params.code);
    if (!authorizationCode) {
      writeHttpResponse(connection, '<html><body>Missing authorization code. You can close this tab.</body></html>', '400 Bad Request');
      closeConnection(connection);
      finish({ ok: false, errorKind: 'parse' });
      return;
    }

    const exchanged = await exchangeCodexAuthorizationCode({
      authorizationCode,
      codeVerifier: pkce.codeVerifier,
      redirectUri,
      requestTextFn,
    });

    if (!exchanged.ok) {
      writeHttpResponse(connection, '<html><body>Could not finish sign-in. You can close this tab.</body></html>', '500 Internal Server Error');
      closeConnection(connection);
      finish(exchanged);
      return;
    }

    writeHttpResponse(connection, '<html><body>Sign-in complete. You can close this tab and return to GNOME Settings.</body></html>');
    closeConnection(connection);
    finish({ ok: true, auth: exchanged.auth });
  }

  incomingId = service.connect('incoming', (svc, connection) => {
    handleIncoming(connection).catch(() => {
      closeConnection(connection);
      finish({ ok: false, errorKind: 'network' });
    });
    return true;
  });

  service.start();

  return {
    ok: true,
    authUrl,
    cancel() {
      finish({ ok: false, errorKind: 'cancelled' });
    },
    completion,
  };
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
