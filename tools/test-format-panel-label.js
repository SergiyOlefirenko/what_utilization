import { assertEqual } from './testlib.js';
import { formatPanelLabel, formatCopilotUsage, formatCodexUsage } from '../lib/format.js';

assertEqual(formatCopilotUsage(), 'gh: --%');
assertEqual(formatCopilotUsage(58), 'gh: 58%');
assertEqual(formatCodexUsage(), '5h: --% w: --%');
assertEqual(formatCodexUsage({ dailyPercent: 93, weeklyPercent: 98 }), '5h: 93% w: 98%');

assertEqual(formatPanelLabel(), 'gh: --% 5h: --% w: --%');
assertEqual(formatPanelLabel({ ghPercent: 0, dailyPercent: 1, weeklyPercent: 2 }), 'gh: 0% 5h: 1% w: 2%');
assertEqual(formatPanelLabel({ ghPercent: 101, dailyPercent: -1, weeklyPercent: 49.6 }), 'gh: 100% 5h: 0% w: 50%');
assertEqual(formatPanelLabel({ ghPercent: 10, dailyPercent: 20, weeklyPercent: 30, showGh: false }), '5h: 20% w: 30%');
assertEqual(
  formatPanelLabel({ ghPercent: 10, dailyPercent: 20, weeklyPercent: 30, showCodex: false }),
  'gh: 10%'
);
assertEqual(formatPanelLabel({ showGh: false, showCodex: false }), 'AI: off');
