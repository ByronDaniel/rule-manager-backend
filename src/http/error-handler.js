import { randomUUID } from 'node:crypto';

const DUPLICATE_KEY = 11000;

/** Renders every error as RFC 9457 problem details, hiding internals for 5xx responses. */
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.status || (error.code === DUPLICATE_KEY ? 409 : 500);
  const code = error.code === DUPLICATE_KEY ? 'DUPLICATE_RESOURCE' : typeof error.code === 'string' ? error.code : status === 400 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR';
  if (status === 401) res.set('WWW-Authenticate', 'Bearer');
  res.status(status).type('application/problem+json').json({
    type: `https://api.banco.example/problems/${code.toLowerCase().replaceAll('_', '-')}`,
    title: status >= 500 ? 'Error interno' : 'Solicitud no procesada',
    status,
    businessCode: code,
    detail: status >= 500 ? 'No fue posible procesar la solicitud.' : error.message,
    correlationId: req.correlationId ?? randomUUID()
  });
}
