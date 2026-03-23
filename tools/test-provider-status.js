import { assertEqual } from './testlib.js';
import { formatCodexStatus, formatCopilotStatus } from '../lib/providerStatus.js';

assertEqual(formatCodexStatus(null, false), 'Codex: disabled');
assertEqual(formatCopilotStatus(null, false), 'Copilot: disabled');

assertEqual(formatCodexStatus({ ok: false, errorKind: 'not_configured' }, true), 'Codex: sign in required');
assertEqual(formatCopilotStatus({ ok: false, errorKind: 'auth' }, true), 'Copilot: auth failed');
assertEqual(formatCodexStatus({ ok: false, errorKind: 'network' }, true), 'Codex: network error');
assertEqual(formatCopilotStatus({ ok: false, errorKind: 'parse' }, true), 'Copilot: parse error');
assertEqual(formatCodexStatus({ ok: false, errorKind: 'http', status: 429 }, true), 'Codex: http 429');

assertEqual(
  formatCodexStatus({ ok: true, planType: 'codex-pro', windows: [] }, true),
  'Codex: codex-pro'
);
assertEqual(
  formatCodexStatus({
    ok: true,
    planType: 'codex-pro',
    windows: [
      { label: 'Day', resetAtMs: new Date(2026, 2, 3, 5, 7).getTime() },
      { label: 'Week', resetAtMs: new Date(2026, 2, 10, 16, 45).getTime() },
    ],
  }, true),
  'Codex: codex-pro\n - 5h: 2026-03-03 05:07\n - w: 2026-03-10 16:45'
);
assertEqual(
  formatCodexStatus({
    ok: true,
    planType: 'plus',
    windows: [
      { label: 'Day', resetAtMs: new Date(2026, 2, 3, 9, 3).getTime() },
      { label: 'Week', resetAtMs: null },
    ],
  }, true),
  'Codex: plus\n - 5h: 2026-03-03 09:03'
);
assertEqual(
  formatCodexStatus({ ok: true, planType: 'pro' }, true),
  'Codex: pro'
);
assertEqual(
  formatCodexStatus({
    ok: true,
    planType: 'broken',
    windows: [
      { label: 'Day', resetAtMs: 9e15 },
    ],
  }, true),
  'Codex: broken'
);
assertEqual(
  formatCodexStatus({
    ok: true,
    planType: 'team',
    windows: [
      { label: 'Week', resetAtMs: new Date(2026, 2, 10, 0, 2).getTime() },
    ],
  }, true),
  'Codex: team\n - w: 2026-03-10 00:02'
);
assertEqual(
  formatCopilotStatus({ ok: true, plan: 'pro', resetDate: '2026-03-31' }, true),
  'Copilot: pro (reset: 2026-03-31)'
);
