import { assertEqual, assert } from './testlib.js';
import { Poller } from '../lib/poller.js';

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

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

let updates = 0;
const lookupGate = deferred();
const p4 = new Poller({
  providers: {
    codex: async () => ({ ok: false, errorKind: 'network' }),
  },
  lookupToken: async () => await lookupGate.promise,
  requestJson: async () => ({ ok: true, status: 200, json: {} }),
  intervalSeconds: 10,
  onUpdate: () => {
    updates += 1;
  },
  backoffBaseSeconds: 5,
});

const inFlight = p4.pollOnce();
p4.stop();
lookupGate.resolve('dummy');
const aborted = await inFlight;

assertEqual(aborted, null, 'expected aborted poll to resolve to null');
assertEqual(updates, 0, 'expected no updates from stale poll');
assertEqual(Object.keys(p4.snapshot).length, 0, 'expected stale poll snapshot to stay empty');
assertEqual(p4._backoff.failures, 0, 'expected stale poll not to affect backoff');
assertEqual(p4._cancellable, null, 'expected stale poll not to restore cancellable');
assertEqual(p4._inFlight, false, 'expected poller to remain idle after stop');
