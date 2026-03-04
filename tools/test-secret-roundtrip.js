import { assertEqual, assert } from './testlib.js';
import { lookupToken, storeToken, clearToken } from '../lib/secrets.js';

const provider = 'test-roundtrip';
const value = `dummy-token-${Date.now()}`;

await clearToken(provider);
assertEqual(await lookupToken(provider), null);

await storeToken(provider, value);
assertEqual(await lookupToken(provider), value);

await clearToken(provider);
assertEqual(await lookupToken(provider), null);
