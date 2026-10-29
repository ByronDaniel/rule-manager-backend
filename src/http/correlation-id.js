import { randomUUID } from 'node:crypto';

/** Propagates X-Correlation-Id, generating one when the client does not send it. */
export function correlationId(req, res, next) {
  req.correlationId = req.get('X-Correlation-Id') || randomUUID();
  res.set('X-Correlation-Id', req.correlationId);
  next();
}
