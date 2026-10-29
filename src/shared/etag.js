import { createHash } from 'node:crypto';
import { fail } from './errors.js';

export function etag(value) {
  return `"${createHash('sha256').update(JSON.stringify(value)).digest('base64url')}"`;
}

/** Optimistic concurrency: the If-Match header must carry the resource's current ETag. */
export function requireMatch(header, resource) {
  if (!header) fail(428, 'PRECONDITION_REQUIRED', 'Se requiere If-Match.');
  if (header !== etag(resource)) fail(412, 'STALE_ETAG', 'El recurso ha cambiado; vuelva a consultarlo.');
}
