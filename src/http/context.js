/** What the services need from a request: who acts, with which roles, and the write headers. */
export function requestContext(req) {
  return {
    actor: req.identity.sub,
    roles: req.identity.roles,
    correlationId: req.correlationId,
    match: req.get('If-Match'),
    key: req.get('Idempotency-Key'),
    body: req.body
  };
}
