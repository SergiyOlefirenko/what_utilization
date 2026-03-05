import { assertEqual, assert, readJsonFile } from './testlib.js';
import { parseCodexWham } from '../lib/parsers/codexWham.js';

const basic = parseCodexWham(readJsonFile('tools/fixtures/wham-usage-basic.json'));
assert(basic.ok, 'expected ok parse');
assertEqual(basic.planType, 'pro');
assertEqual(basic.dailyPercent, 20);
assertEqual(basic.weeklyPercent, 50);
assertEqual(basic.windows[0].label, 'Day');
assertEqual(basic.windows[1].label, 'Week');

const plus = parseCodexWham(readJsonFile('tools/fixtures/wham-usage-plus.json'));
assert(plus.ok, 'expected ok parse');
assertEqual(plus.planType, 'plus');
assertEqual(plus.dailyPercent, 7);
assertEqual(plus.weeklyPercent, 2);
assertEqual(plus.windows[0].label, 'Day');
assertEqual(plus.windows[1].label, 'Week');

const noWeekly = parseCodexWham(readJsonFile('tools/fixtures/wham-usage-no-weekly.json'));
assert(noWeekly.ok, 'expected ok parse with no weekly window');
assertEqual(noWeekly.planType, 'plus');
assertEqual(noWeekly.dailyPercent, 9);
assertEqual(noWeekly.weeklyPercent, null);
assertEqual(noWeekly.windows.length, 1);
assertEqual(noWeekly.windows[0].label, 'Day');
