import { Problem } from '../../shared/errors.js';

/** Lets the request through only if the user has at least one of the roles. */
export const requireRoles = (...allowed) => (req, res, next) => {
  if (!req.identity.roles.some(role => allowed.includes(role))) return next(new Problem(403, 'FORBIDDEN', 'El usuario no tiene permisos para esta operación.'));
  next();
};

/** Roles that read the parameter catalog and change requests. */
export const catalogReaders = requireRoles('MAKER', 'CHECKER', 'ADMIN', 'AUDITOR');
/** Roles that manage parameter definitions. */
export const catalogWriters = requireRoles('MAKER', 'ADMIN');
