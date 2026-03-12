import { assertEqual } from './testlib.js';
import { formatCodexStatus, formatCopilotStatus } from '../lib/providerStatus.js';

assertEqual(formatCodexStatus(null, false), 'Codex: disabled');
assertEqual(formatCopilotStatus(null, false), 'Copilot: disabled');

assertEqual(formatCodexStatus({ ok: false, errorKind: 'not_configured' }, true), 'Codex: run codex login');
assertEqual(formatCopilotStatus({ ok: false, errorKind: 'auth' }, true), 'Copilot: auth failed');
assertEqual(formatCodexStatus({ ok: false, errorKind: 'network' }, true), 'Codex: network error');
assertEqual(formatCopilotStatus({ ok: false, errorKind: 'parse' }, true), 'Copilot: parse error');
assertEqual(formatCodexStatus({ ok: false, errorKind: 'http', status: 429 }, true), 'Codex: http 429');

assertEqual(
  formatCodexStatus({ ok: true, planType: 'codex-pro', windows: [] }, true),
  'Codex: codex-pro'
);
assertEqual(
  formatCopilotStatus({ ok: true, plan: 'pro', resetDate: '2026-03-31' }, true),
  'Copilot: pro (reset: 2026-03-31)'
);
