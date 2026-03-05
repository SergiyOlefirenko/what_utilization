import { assertEqual, assert } from './testlib.js';
import { Poller } from '../lib/poller.js';

function makePoller({ providerResult, intervalSeconds = 10, backoffBaseSeconds = 5 }) {
  return new Poller({
    providers: {
      codex: async () => providerResult,
    },
    lookupToken: async () => 'dummy',
    requestJson: async () => ({ ok: true, status: 200, json: {} }),
    intervalSeconds,
    onUpdate: () => {},
    backoffBaseSeconds,
  });
}

const p1 = makePoller({ providerResult: { ok: false, errorKind: 'network' } });
const r1 = await p1.pollOnce();
assert(r1.hadFailure, 'expected failure');
assertEqual(r1.nextDelaySeconds, 10);

const r2 = await p1.pollOnce();
assert(r2.hadFailure, 'expected failure');
assertEqual(r2.nextDelaySeconds, 20);

const p2 = makePoller({ providerResult: { ok: true } });
const r3 = await p2.pollOnce();
assert(!r3.hadFailure, 'expected success');
assertEqual(r3.nextDelaySeconds, 10);

const p3 = new Poller({
  providers: {
    codex: async () => ({ ok: true, dailyPercent: 10, weeklyPercent: 20 }),
    copilot: async () => ({ ok: true, usedPercent: 30 }),
  },
  lookupToken: async () => 'dummy',
  requestJson: async () => ({ ok: true, status: 200, json: {} }),
  intervalSeconds: 10,
  onUpdate: () => {},
  backoffBaseSeconds: 5,
});

await p3.pollOnce();
assert('codex' in p3.snapshot, 'expected codex in snapshot');
assert('copilot' in p3.snapshot, 'expected copilot in snapshot');

p3.setProviders({
  codex: async () => ({ ok: true, dailyPercent: 1, weeklyPercent: 2 }),
});
assert('codex' in p3.snapshot, 'expected codex to remain in snapshot');
assert(!('copilot' in p3.snapshot), 'expected copilot to be pruned from snapshot');
