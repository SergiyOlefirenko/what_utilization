import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';

const _session = new Soup.Session();

export function getSession() {
  return _session;
}

function _bytesToString(bytes) {
  if (!bytes)
    return '';
  return new TextDecoder('utf-8').decode(bytes);
}

export async function requestText({
  method = 'GET',
  url,
  headers = {},
  body = null,
  contentType = 'application/json',
  cancellable = null,
} = {}) {
  const message = Soup.Message.new(method, url);
  for (const [k, v] of Object.entries(headers))
    message.request_headers.append(k, v);

  if (body !== null && body !== undefined) {
    const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
    message.set_request_body_from_bytes(contentType, new GLib.Bytes(bytes));
  }

  const bytes = await _session.send_and_read_async(message, Soup.MessagePriority.NORMAL, cancellable);
  const text = _bytesToString(bytes?.get_data?.() ?? null);
  return { status: message.status_code, headers: message.response_headers, text };
}

export async function requestJson(opts = {}) {
  const { status, text } = await requestText(opts);
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    return { status, ok: false, errorKind: 'parse', text };
  }
  return { status, ok: status >= 200 && status < 300, json, text };
}
