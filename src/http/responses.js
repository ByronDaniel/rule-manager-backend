import { etag } from '../shared/etag.js';

/** Sends a `{ status, headers, body }` result produced by a create operation. */
export function sendCreated(res, result) {
  res.set(result.headers).status(result.status).json(result.body);
}

/** Sends a resource with its ETag, answering 304 when the client already has it. */
export function sendResource(req, res, value) {
  const tag = etag(value);
  res.set('ETag', tag);
  if (req.get('If-None-Match') === tag) return res.status(304).end();
  return res.json(value);
}
