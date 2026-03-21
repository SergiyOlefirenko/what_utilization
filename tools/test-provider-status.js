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
  'Codex\n - plan: codex-pro'
);
assertEqual(
  formatCodexStatus({
    ok: true,
    planType: 'codex-pro',
    windows: [
      { label: 'Day', resetAtMs: Date.UTC(2026, 2, 3) },
      { label: 'Week', resetAtMs: Date.UTC(2026, 2, 10) },
    ],
  }, true),
  'Codex\n - plan: codex-pro\n - 5h next reset: 2026-03-03\n - w next reset: 2026-03-10'
);
assertEqual(
  formatCodexStatus({
    ok: true,
    planType: 'plus',
    windows: [
      { label: 'Day', resetAtMs: Date.UTC(2026, 2, 3) },
      { label: 'Week', resetAtMs: null },
    ],
  }, true),
  'Codex\n - plan: plus\n - 5h next reset: 2026-03-03'
);
assertEqual(
  formatCodexStatus({ ok: true, planType: 'pro' }, true),
  'Codex\n - plan: pro'
);
assertEqual(
  formatCodexStatus({
    ok: true,
    planType: 'team',
    windows: [
      { label: 'Week', resetAtMs: Date.UTC(2026, 2, 10) },
    ],
  }, true),
  'Codex\n - plan: team\n - w next reset: 2026-03-10'
);
assertEqual(
  formatCopilotStatus({ ok: true, plan: 'pro', resetDate: '2026-03-31' }, true),
  'Copilot: pro (reset: 2026-03-31)'
);
