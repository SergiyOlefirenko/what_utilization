import { assertEqual, assert, argvHas, readJsonFile } from './testlib.js';
import { fetchCopilotUsage } from '../lib/providers/copilot.js';

if (argvHas('--no-token')) {
  const r = await fetchCopilotUsage({ token: null, requestJson: async () => ({ ok: true, status: 200, json: {} }) });
  assert(!r.ok, 'expected not ok');
  assertEqual(r.errorKind, 'not_configured');
} else {
  const fixture = readJsonFile('tools/fixtures/copilot-user-basic.json');
  const calls = [];
  const cancellable = {};

  const requestJson = async (opts) => {
    calls.push(opts);
    return { ok: true, status: 200, json: fixture };
  };

  const r = await fetchCopilotUsage({ token: 'test-token', requestJson, cancellable });
  assert(r.ok, 'expected ok');
  assertEqual(r.remainingPercent, 58);
  assertEqual(r.plan, 'pro');
  assertEqual(calls.length, 1);
  assertEqual(calls[0].url, 'https://api.github.com/copilot_internal/user');
  assertEqual(calls[0].headers.Authorization, 'token test-token');
  assertEqual(calls[0].cancellable, cancellable);
}
