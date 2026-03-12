import GLib from 'gi://GLib';

import { assert, assertEqual } from './testlib.js';
import {
  buildCodexStatus,
  parseCodexAuthSecret,
  pollCodexDeviceCode,
  requestCodexDeviceCode,
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

const deviceCode = await requestCodexDeviceCode({
  requestJsonFn: async () => ({
    ok: true,
    status: 200,
    json: {
      device_auth_id: 'device-1',
      user_code: 'ABCD-EFGH',
      interval: '7',
    },
  }),
});

assert(deviceCode.ok, 'expected device code request to succeed');
assertEqual(deviceCode.deviceAuthId, 'device-1');
assertEqual(deviceCode.userCode, 'ABCD-EFGH');
assertEqual(deviceCode.intervalSeconds, 7);
assertEqual(deviceCode.verificationUrl, 'https://auth.openai.com/codex/device');

const pendingPoll = await pollCodexDeviceCode({
  deviceAuthId: 'device-1',
  userCode: 'ABCD-EFGH',
  requestJsonFn: async () => ({
    ok: false,
    status: 403,
    json: null,
  }),
});

assert(!pendingPoll.ok, 'expected pending poll result');
assertEqual(pendingPoll.errorKind, 'pending');

const completedPoll = await pollCodexDeviceCode({
  deviceAuthId: 'device-1',
  userCode: 'ABCD-EFGH',
  requestJsonFn: async () => ({
    ok: true,
    status: 200,
    json: {
      authorization_code: 'auth-code',
      code_verifier: 'verifier',
    },
  }),
});

assert(completedPoll.ok, 'expected completed device code poll');
assertEqual(completedPoll.authorizationCode, 'auth-code');
assertEqual(completedPoll.codeVerifier, 'verifier');
