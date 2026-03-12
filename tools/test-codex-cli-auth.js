import { assert, assertEqual } from './testlib.js';
import { parseCodexCliAuthJson, resolveCodexAuthState } from '../lib/codexCliAuth.js';

const parsed = parseCodexCliAuthJson({
  auth_mode: 'chatgpt',
  tokens: {
    access_token: 'access-token',
    account_id: 'workspace-123',
  },
});
assert(parsed.ok, 'expected ChatGPT auth to parse');
assertEqual(parsed.accessToken, 'access-token');
assertEqual(parsed.accountId, 'workspace-123');

const parsedNoMode = parseCodexCliAuthJson({
  tokens: {
    access_token: 'access-token-2',
    id_token: {
      chatgpt_account_id: 'workspace-456',
    },
  },
});
assert(parsedNoMode.ok, 'expected auth without explicit mode to parse');
assertEqual(parsedNoMode.accountId, 'workspace-456');

const unsupported = parseCodexCliAuthJson({
  auth_mode: 'api_key',
  OPENAI_API_KEY: 'sk-test',
});
assert(!unsupported.ok, 'expected api key auth to be unsupported');
assertEqual(unsupported.errorKind, 'unsupported_auth_mode');

const missingToken = parseCodexCliAuthJson({
  auth_mode: 'chatgpt',
  tokens: {},
});
assert(!missingToken.ok, 'expected missing token to fail');
assertEqual(missingToken.errorKind, 'not_logged_in');

const cliState = resolveCodexAuthState({
  cliAuth: {
    ok: true,
    accessToken: 'cli-token',
    accountId: 'workspace-789',
    path: '/tmp/auth.json',
  },
  fallbackToken: 'fallback-token',
  codexInstalled: true,
});
assert(cliState.ok, 'expected cli state to be ok');
assertEqual(cliState.source, 'cli');
assertEqual(cliState.accessToken, 'cli-token');

const fallbackState = resolveCodexAuthState({
  cliAuth: {
    ok: false,
    errorKind: 'not_found',
    path: '/tmp/auth.json',
  },
  fallbackToken: 'fallback-token',
  codexInstalled: true,
});
assert(fallbackState.ok, 'expected fallback state to be ok');
assertEqual(fallbackState.source, 'fallback');
assertEqual(fallbackState.accessToken, 'fallback-token');

const missingCli = resolveCodexAuthState({
  cliAuth: {
    ok: false,
    errorKind: 'not_found',
    path: '/tmp/auth.json',
  },
  fallbackToken: null,
  codexInstalled: false,
});
assert(!missingCli.ok, 'expected missing codex cli to fail');
assertEqual(missingCli.errorKind, 'not_installed');
