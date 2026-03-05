import { assert, assertEqual } from './testlib.js';
import { buildSecretSchemaForTesting } from '../lib/secrets.js';

const staticFactory = {
  SchemaFlags: { NONE: 0 },
  SchemaAttributeType: { STRING: 1 },
  Schema: {
    new: (name, flags, attrs) => ({ name, flags, attrs, kind: 'static' }),
  },
};

const staticSchema = buildSecretSchemaForTesting(staticFactory);
assertEqual(staticSchema.kind, 'static');
assertEqual(staticSchema.name, 'org.gnome.shell.extensions.ai-usage');

const ctorFactory = {
  SchemaFlags: { NONE: 0 },
  SchemaAttributeType: { STRING: 1 },
  Schema: class {
    constructor(name, flags, attrs) {
      this.name = name;
      this.flags = flags;
      this.attrs = attrs;
      this.kind = 'ctor';
    }
  },
};

const ctorSchema = buildSecretSchemaForTesting(ctorFactory);
assertEqual(ctorSchema.kind, 'ctor');
assertEqual(ctorSchema.name, 'org.gnome.shell.extensions.ai-usage');

let threw = false;
try {
  buildSecretSchemaForTesting({
    SchemaFlags: { NONE: 0 },
    SchemaAttributeType: { STRING: 1 },
    Schema: {},
  });
} catch (e) {
  threw = true;
}

assert(threw, 'expected schema init to throw when constructor is unavailable');
