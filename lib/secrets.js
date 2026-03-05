import Secret from 'gi://Secret';

const SCHEMA_NAME = 'org.gnome.shell.extensions.ai-usage';
let _secretSchema = undefined;

export function buildSecretSchemaForTesting(secretApi) {
  if (typeof secretApi?.Schema?.new === 'function') {
    return secretApi.Schema.new(
      SCHEMA_NAME,
      secretApi.SchemaFlags.NONE,
      {
        provider: secretApi.SchemaAttributeType.STRING,
      }
    );
  }

  if (typeof secretApi?.Schema === 'function') {
    return new secretApi.Schema(
      SCHEMA_NAME,
      secretApi.SchemaFlags.NONE,
      {
        provider: secretApi.SchemaAttributeType.STRING,
      }
    );
  }

  throw new Error('Secret schema constructor unavailable');
}

function _getSecretSchema() {
  if (_secretSchema !== undefined)
    return _secretSchema;

  try {
    _secretSchema = buildSecretSchemaForTesting(Secret);
  } catch (e) {
    _secretSchema = null;
  }

  return _secretSchema;
}

function _attrs(provider) {
  return { provider };
}

function _lookup(schema, attrs, cancellable) {
  return new Promise((resolve, reject) => {
    Secret.password_lookup(schema, attrs, cancellable, (source, result) => {
      try {
        resolve(Secret.password_lookup_finish(result));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function _store(schema, attrs, collection, label, password, cancellable) {
  return new Promise((resolve, reject) => {
    Secret.password_store(schema, attrs, collection, label, password, cancellable, (source, result) => {
      try {
        resolve(Secret.password_store_finish(result));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function _clear(schema, attrs, cancellable) {
  return new Promise((resolve, reject) => {
    Secret.password_clear(schema, attrs, cancellable, (source, result) => {
      try {
        resolve(Secret.password_clear_finish(result));
      } catch (e) {
        reject(e);
      }
    });
  });
}

export async function lookupToken(provider) {
  const secretSchema = _getSecretSchema();
  if (!secretSchema)
    return null;

  try {
    const token = await _lookup(secretSchema, _attrs(provider), null);
    return token ?? null;
  } catch (e) {
    return null;
  }
}

export async function storeToken(provider, token) {
  const secretSchema = _getSecretSchema();
  if (!secretSchema)
    throw new Error('Secret schema unavailable');

  const value = `${token ?? ''}`.trim();
  if (!value)
    throw new Error('Token must be non-empty');

  await _store(
    secretSchema,
    _attrs(provider),
    Secret.COLLECTION_DEFAULT,
    `AI Usage Token (${provider})`,
    value,
    null
  );
}

export async function clearToken(provider) {
  const secretSchema = _getSecretSchema();
  if (!secretSchema)
    throw new Error('Secret schema unavailable');

  await _clear(secretSchema, _attrs(provider), null);
}
