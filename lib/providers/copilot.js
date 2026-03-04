import { parseCopilotUser } from '../parsers/copilotUser.js';

export const COPILOT_PROVIDER = 'copilot';

export async function fetchCopilotUsage({ token, requestJson }) {
  if (!token)
    return { ok: false, errorKind: 'not_configured' };

  const url = 'https://api.github.com/copilot_internal/user';
  const headers = {
    'Accept': 'application/json',
    'Authorization': `token ${token}`,
    'User-Agent': 'ai-usage-gnome-extension',
    'X-Github-Api-Version': '2022-11-28',
    'Editor-Version': 'vscode/1.87.0',
  };

  let resp;
  try {
    resp = await requestJson({ method: 'GET', url, headers });
  } catch (e) {
    return { ok: false, errorKind: 'network' };
  }

  if (!resp.ok)
    return { ok: false, errorKind: resp.status === 401 || resp.status === 403 ? 'auth' : 'http', status: resp.status };

  const parsed = parseCopilotUser(resp.json);
  if (!parsed.ok)
    return { ok: false, errorKind: 'parse' };

  return {
    ok: true,
    usedPercent: parsed.usedPercent,
    plan: parsed.plan,
    resetDate: parsed.resetDate,
  };
}
