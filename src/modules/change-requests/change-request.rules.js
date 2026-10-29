import { fail } from '../../shared/errors.js';
import { requireMatch } from '../../shared/etag.js';
import { validateValue } from '../parameters/parameter.rules.js';

const REVIEWER_ROLES = ['CHECKER', 'ADMIN', 'AUDITOR'];

/** Reviewers see every request; makers only their own. */
export function canSeeAllRequests(roles) {
  return roles.some(role => REVIEWER_ROLES.includes(role));
}

/** Validates a proposal against the parameter state; used on creation and again on approval. */
export function validateRequest(parameter, request, versions, now = new Date()) {
  if (versions.length && !request.baseVersionNumber) fail(422, 'BASE_VERSION_REQUIRED', 'Se requiere la versión base.');
  if (request.changeType === 'SET_VALUE') {
    if (!Object.hasOwn(request, 'proposedValue')) fail(422, 'VALUE_REQUIRED', 'Se requiere el valor propuesto.');
    validateValue(parameter.dataType, request.proposedValue, parameter.constraints);
  } else if (Object.hasOwn(request, 'proposedValue')) fail(422, 'VALUE_NOT_ALLOWED', 'Este cambio no admite un valor propuesto.');
  if (request.changeType === 'DEACTIVATE' && parameter.status !== 'ACTIVE') fail(409, 'INVALID_STATE_TRANSITION', 'Solo se pueden desactivar parámetros activos.');
  if (request.changeType === 'REACTIVATE' && (parameter.status !== 'INACTIVE' || !versions.some(version => version.changeType === 'SET_VALUE'))) fail(409, 'INVALID_STATE_TRANSITION', 'No existe un valor publicado para reactivar.');
  const start = request.effectiveFrom ? new Date(request.effectiveFrom) : now;
  if (request.effectiveTo && (new Date(request.effectiveTo) <= start || new Date(request.effectiveTo) <= now)) fail(422, 'INVALID_EFFECTIVE_PERIOD', 'El fin de vigencia debe ser posterior al inicio y a la fecha actual.');
}

/** Maker-checker: a fresh ETag, a pending request and a decider other than its creator. */
export function assertDecision(request, actor, match) {
  requireMatch(match, request);
  if (request.createdBy === actor) fail(403, 'MAKER_CHECKER_VIOLATION', 'El creador no puede decidir su propia propuesta.');
  if (request.status !== 'PENDING_APPROVAL') fail(409, 'INVALID_STATE_TRANSITION', 'La propuesta ya fue resuelta.');
}
