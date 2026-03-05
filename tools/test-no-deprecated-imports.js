import { assert, readTextFile } from './testlib.js';

const extension = readTextFile('extension.js');
const prefs = readTextFile('prefs.js');
const code = `${extension}\n${prefs}`;

assert(
  !code.includes('resource:///org/gnome/shell/misc/extensionUtils.js'),
  'Do not use deprecated extensionUtils resource import'
);
