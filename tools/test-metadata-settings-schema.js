import { assert, assertEqual, readJsonFile } from './testlib.js';

const metadata = readJsonFile('metadata.json');

assert(typeof metadata['settings-schema'] === 'string', 'metadata.settings-schema must be present');
assert(metadata['settings-schema'].length > 0, 'metadata.settings-schema must be non-empty');
assertEqual(metadata['settings-schema'], 'org.gnome.shell.extensions.ai-usage');
