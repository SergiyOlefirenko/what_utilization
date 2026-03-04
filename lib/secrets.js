import Secret from 'gi://Secret';

const SCHEMA_NAME = 'org.gnome.shell.extensions.ai-usage';

const SECRET_SCHEMA = new Secret.Schema(
  SCHEMA_NAME,
  Secret.SchemaFlags.NONE,
  {
    provider: Secret.SchemaAttributeType.STRING,
  }
);

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
  try {
    const token = await _lookup(SECRET_SCHEMA, _attrs(provider), null);
    return token ?? null;
  } catch (e) {
    return null;
  }
}

export async function storeToken(provider, token) {
  const value = `${token ?? ''}`.trim();
  if (!value)
    throw new Error('Token must be non-empty');

  await _store(
    SECRET_SCHEMA,
    _attrs(provider),
    Secret.COLLECTION_DEFAULT,
    `AI Usage Token (${provider})`,
    value,
    null
  );
}

export async function clearToken(provider) {
  await _clear(SECRET_SCHEMA, _attrs(provider), null);
}
