import { assertEqual, assert, readJsonFile } from './testlib.js';
import { parseCopilotUser } from '../lib/parsers/copilotUser.js';

const json = readJsonFile('tools/fixtures/copilot-user-basic.json');
const parsed = parseCopilotUser(json);

assert(parsed.ok, 'expected ok parse');
assertEqual(parsed.usedPercent, 42);
assertEqual(parsed.plan, 'pro');
assertEqual(parsed.resetDate, '2026-03-31');
