import { assertEqual } from './testlib.js';
import { formatPanelLabel } from '../lib/format.js';

assertEqual(formatPanelLabel(), 'gh:--% d:--% w:--%');
assertEqual(formatPanelLabel({ ghPercent: 0, dailyPercent: 1, weeklyPercent: 2 }), 'gh:0% d:1% w:2%');
assertEqual(formatPanelLabel({ ghPercent: 101, dailyPercent: -1, weeklyPercent: 49.6 }), 'gh:100% d:0% w:50%');
