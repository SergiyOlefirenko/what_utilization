import { assertEqual, assert, readJsonFile } from './testlib.js';
import { parseCodexWham } from '../lib/parsers/codexWham.js';

const basic = parseCodexWham(readJsonFile('tools/fixtures/wham-usage-basic.json'));
assert(basic.ok, 'expected ok parse');
assertEqual(basic.planType, 'codex-pro');
assertEqual(basic.dailyPercent, 20);
assertEqual(basic.weeklyPercent, 50);
assertEqual(basic.windows[0].label, 'Day');
assertEqual(basic.windows[1].label, 'Week');

const plus = parseCodexWham(readJsonFile('tools/fixtures/wham-usage-plus.json'));
assert(plus.ok, 'expected ok parse');
assertEqual(plus.planType, 'codex-plus');
assertEqual(plus.dailyPercent, 80);
assertEqual(plus.weeklyPercent, 20);
assertEqual(plus.windows[0].label, 'Day');
assertEqual(plus.windows[1].label, 'Week');
