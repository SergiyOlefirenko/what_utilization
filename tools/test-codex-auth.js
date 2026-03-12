import GLib from 'gi://GLib';

import { assert, assertEqual } from './testlib.js';
import {
  buildCodexStatus,
  parseCodexAuthSecret,
  startCodexBrowserLogin,
} from '../lib/codexAuth.js';

function base64UrlEncode(text) {
  return GLib.base64_encode(new TextEncoder().encode(text))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function makeJwt(payload) {
  return [
    base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' })),
    base64UrlEncode(JSON.stringify(payload)),
    'sig',
  ].join('.');
}

const accessToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 600 });
const idToken = makeJwt({
  'https://api.openai.com/auth': {
    chatgpt_account_id: 'workspace-123',
    chatgpt_plan_type: 'pro',
  },
});

const parsed = parseCodexAuthSecret(JSON.stringify({
  accessToken,
  refreshToken: 'refresh-token',
  idToken,
}));

assert(parsed, 'expected codex auth secret to parse');
assertEqual(parsed.accountId, 'workspace-123');
assertEqual(parsed.planType, 'pro');
assert(parsed.expiresAtMs > Date.now(), 'expected future expiry');
assertEqual(buildCodexStatus(parsed), 'Connected (pro, workspace-123)');
assertEqual(buildCodexStatus(null), 'Not connected');

const session = startCodexBrowserLogin();

assert(session.ok, 'expected browser login session');
assert(session.authUrl.includes('response_type=code'), 'expected authorize url');
assert(session.authUrl.includes('client_id=app_EMoamEEZ73f0CkXaXp7hrann'), 'expected client id in authorize url');
assert(session.authUrl.includes(encodeURIComponent('http://localhost:1455/auth/callback')), 'expected fixed localhost redirect uri');
assert(session.authUrl.includes('code_challenge='), 'expected pkce challenge in authorize url');

session.cancel();
const cancelled = await session.completion;
assert(!cancelled.ok, 'expected cancelled browser login');
assertEqual(cancelled.errorKind, 'cancelled');
