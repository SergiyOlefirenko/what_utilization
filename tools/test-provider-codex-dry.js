import { assertEqual, assert, argvHas, readJsonFile } from './testlib.js';
import { fetchCodexUsage } from '../lib/providers/codex.js';

if (argvHas('--no-token')) {
  const r = await fetchCodexUsage({ token: null, requestJson: async () => ({ ok: true, status: 200, json: {} }) });
  assert(!r.ok, 'expected not ok');
  assertEqual(r.errorKind, 'not_configured');
} else {
  const fixture = readJsonFile('tools/fixtures/wham-usage-basic.json');
  const calls = [];
  const cancellable = {};

  const requestJson = async (opts) => {
    calls.push(opts);
    return { ok: true, status: 200, json: fixture };
  };

  const r = await fetchCodexUsage({ token: 'test-token', requestJson, cancellable });
  assert(r.ok, 'expected ok');
  assertEqual(r.dailyPercent, 20);
  assertEqual(r.weeklyPercent, 50);
  assertEqual(calls.length, 1);
  assertEqual(calls[0].url, 'https://api.openai.com/v1/usage/wham');
  assertEqual(calls[0].headers.Authorization, 'Bearer test-token');
  assertEqual(calls[0].cancellable, cancellable);
}
