import { Problem } from '../shared/errors.js';

const DECISION_PATH = /\/(approval|rejection)$/;

/** Writes protected by optimistic concurrency must send If-Match. Checked before contract validation. */
export function requireIfMatch(req, res, next) {
  const guarded = ['PUT', 'DELETE'].includes(req.method) || (req.method === 'POST' && DECISION_PATH.test(req.path));
  if (guarded && !req.get('If-Match')) return next(new Problem(428, 'PRECONDITION_REQUIRED', 'Se requiere If-Match.'));
  next();
}
