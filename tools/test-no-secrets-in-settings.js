import { assert } from './testlib.js';
import { readTextFile } from './testlib.js';

const xml = readTextFile('schemas/org.gnome.shell.extensions.ai-usage.gschema.xml');

assert(!xml.includes('token'), 'GSettings schema must not contain token-like keys');
assert(!xml.includes('authorization'), 'GSettings schema must not contain auth-like keys');
