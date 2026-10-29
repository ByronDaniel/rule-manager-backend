import { fail } from '../../shared/errors.js';
import { verifyToken } from './tokens.js';

const LOGIN_PATH = '/api/v1/auth/token';

/** Requires a valid bearer token on every request except login, and exposes its claims as `req.identity`. */
export function authenticate(config) {
  return (req, res, next) => {
    try {
      if (req.path === LOGIN_PATH && req.method === 'POST') return next();
      const authorization = req.get('Authorization');
      if (!authorization?.startsWith('Bearer ')) fail(401, 'UNAUTHORIZED', 'Se requiere un token Bearer.');
      try { req.identity = verifyToken(authorization.slice(7), config); }
      catch { fail(401, 'UNAUTHORIZED', 'El token es inválido o expiró.'); }
      if (!Array.isArray(req.identity.roles) || typeof req.identity.sub !== 'string') fail(401, 'UNAUTHORIZED', 'El token no contiene una identidad válida.');
      next();
    } catch (error) { next(error); }
  };
}
