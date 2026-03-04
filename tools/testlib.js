import Gio from 'gi://Gio';

export function assert(cond, msg) {
  if (!cond)
    throw new Error(msg || 'assertion failed');
}

export function assertEqual(actual, expected, msg) {
  if (actual !== expected)
    throw new Error(msg || `expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}

export function readTextFile(path) {
  const file = Gio.File.new_for_path(path);
  const [, bytes] = file.load_contents(null);
  return new TextDecoder('utf-8').decode(bytes);
}

export function readJsonFile(path) {
  return JSON.parse(readTextFile(path));
}

export function argvHas(flag) {
  return (ARGV ?? []).includes(flag);
}
