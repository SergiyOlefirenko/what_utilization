import { parseCodexWham } from '../parsers/codexWham.js';
import { loadCodexAuth, refreshCodexAuth } from '../codexAuth.js';

export const CODEX_PROVIDER = 'codex';

export async function fetchCodexUsage({
  token,
  requestJson,
  requestTextFn,
  loadAuthFn = loadCodexAuth,
  refreshAuthFn = refreshCodexAuth,
  cancellable = null,
} = {}) {
  if (!token)
    return { ok: false, errorKind: 'not_configured' };

  const url = 'https://chatgpt.com/backend-api/wham/usage';
  const headers = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  let resp;
  try {
    resp = await requestJson({ method: 'GET', url, headers, cancellable });
  } catch (e) {
    return { ok: false, errorKind: 'network' };
  }

  if (!resp.ok && (resp.status === 401 || resp.status === 403) && typeof requestTextFn === 'function') {
    const auth = await loadAuthFn();
    const refreshed = await refreshAuthFn({ auth, requestTextFn, cancellable });
    if (refreshed.ok) {
      try {
        resp = await requestJson({
          method: 'GET',
          url,
          headers: {
            ...headers,
            'Authorization': `Bearer ${refreshed.auth.accessToken}`,
          },
          cancellable,
        });
      } catch (e) {
        return { ok: false, errorKind: 'network' };
      }
    }
  }

  if (!resp.ok)
    return { ok: false, errorKind: resp.status === 401 || resp.status === 403 ? 'auth' : 'http', status: resp.status };

  const parsed = parseCodexWham(resp.json);
  if (!parsed.ok)
    return { ok: false, errorKind: 'parse' };

  return {
    ok: true,
    planType: parsed.planType,
    dailyPercent: parsed.dailyPercent,
    weeklyPercent: parsed.weeklyPercent,
    windows: parsed.windows,
  };
}
