import { randomUUID } from 'node:crypto';
import { fail } from '../../shared/errors.js';
import { etag, requireMatch } from '../../shared/etag.js';
import { findById, listPage, page, pick } from '../../shared/queries.js';
import { now } from '../../shared/time.js';
import { effectiveVersion } from '../versions/version.rules.js';
import { assertDecision, canSeeAllRequests, validateRequest } from './change-request.rules.js';

/** Maker-checker workflow: proposals, cancellation and approval or rejection. */
export class ChangeRequestsService {
  constructor(store, { audit, idempotency, versions }) {
    this.store = store;
    this.audit = audit;
    this.idempotency = idempotency;
    this.versions = versions;
  }

  async list(query, context) {
    const filter = pick(query, ['status', 'parameterId', 'changeType', 'createdBy']);
    if (!canSeeAllRequests(context.roles)) {
      if (filter.createdBy && filter.createdBy !== context.actor) return page([], Number(query.page ?? 0), Number(query.size ?? 20), 0);
      filter.createdBy = context.actor;
    }
    if (query.createdFrom || query.createdTo) filter.createdAt = { ...(query.createdFrom ? { $gte: query.createdFrom } : {}), ...(query.createdTo ? { $lte: query.createdTo } : {}) };
    return listPage(this.store.repo('requests'), filter, query, 'createdAt,desc');
  }

  /** A request the user may see; others are reported as not found. */
  async getVisible(id, context) {
    const request = await findById(this.store.repo('requests'), id);
    if (!canSeeAllRequests(context.roles) && request.createdBy !== context.actor) fail(404, 'NOT_FOUND', 'No se encontró la propuesta.');
    return request;
  }

  async getDecision(id, approved, context) {
    await this.getVisible(id, context);
    const decision = await this.store.repo('decisions').findOne({ changeRequestId: id, decision: approved ? 'APPROVED' : 'REJECTED' });
    if (!decision) fail(404, 'NOT_FOUND', 'No existe la decisión solicitada.');
    return decision;
  }

  async create(body, context) {
    return this.idempotency.run(context, 'createRequest', async session => {
      await this.versions.synchronize(body.parameterId, session);
      const parameter = await findById(this.store.repo('parameters', session), body.parameterId);
      const versions = await this.store.repo('versions', session).find({ parameterId: parameter.id }, { sort: { versionNumber: -1 } });
      validateRequest(parameter, body, versions);
      const request = {
        ...body,
        ...(body.effectiveFrom ? { effectiveFrom: new Date(body.effectiveFrom).toISOString() } : {}),
        ...(body.effectiveTo ? { effectiveTo: new Date(body.effectiveTo).toISOString() } : {}),
        id: randomUUID(),
        parameterCode: parameter.code,
        status: 'PENDING_APPROVAL',
        createdAt: now(),
        createdBy: context.actor
      };
      await this.store.repo('requests', session).insert(request);
      await this.audit.record(session, context, 'CHANGE_REQUEST_CREATED', 'CHANGE_REQUEST', request.id, parameter.id);
      return { status: 201, body: request, headers: { ETag: etag(request), Location: `/api/v1/change-requests/${request.id}` } };
    });
  }

  /** Withdraws a pending request; only its creator can. */
  async cancel(id, context) {
    return this.store.transaction(async session => {
      const requests = this.store.repo('requests', session);
      const request = await findById(requests, id);
      if (request.createdBy !== context.actor) fail(403, 'FORBIDDEN', 'Solo el creador puede cancelar la propuesta.');
      requireMatch(context.match, request);
      if (request.status !== 'PENDING_APPROVAL') fail(409, 'INVALID_STATE_TRANSITION', 'La propuesta ya fue resuelta.');
      await requests.update({ id }, { $set: { status: 'CANCELLED' } });
      await this.audit.record(session, context, 'CHANGE_REQUEST_CANCELLED', 'CHANGE_REQUEST', id, request.parameterId);
    });
  }

  /** Approves (publishing a new version) or rejects a pending request. */
  async decide(id, approved, body, context) {
    return this.idempotency.run(context, `${approved ? 'approve' : 'reject'}:${id}`, async session => {
      const requests = this.store.repo('requests', session);
      const request = await findById(requests, id);
      assertDecision(request, context.actor, context.match);
      const decidedAt = now();
      const decision = { changeRequestId: id, decision: approved ? 'APPROVED' : 'REJECTED', decidedBy: context.actor, decidedAt };
      if (approved) {
        const version = await this.publish(session, request, context, decidedAt);
        Object.assign(decision, { resultingVersionNumber: version.versionNumber, publicationStatus: version.status }, body.comment ? { comment: body.comment } : {});
      } else decision.rejectionReason = body.reason;
      await requests.update({ id }, { $set: { status: decision.decision, decidedAt, decidedBy: context.actor, ...(decision.resultingVersionNumber ? { resultingVersionNumber: decision.resultingVersionNumber } : {}) } });
      await this.store.repo('decisions', session).insert(decision);
      await this.audit.record(session, context, approved ? 'CHANGE_REQUEST_APPROVED' : 'CHANGE_REQUEST_REJECTED', 'CHANGE_REQUEST', id, request.parameterId);
      return { status: 201, body: decision, headers: { Location: `/api/v1/change-requests/${id}/${approved ? 'approval' : 'rejection'}` } };
    });
  }

  /**
   * Creates the version an approved request produces. It takes effect now unless the request is scheduled,
   * in which case the parameter is left as is until synchronization activates it.
   */
  async publish(session, request, context, decidedAt) {
    await this.versions.synchronize(request.parameterId, session);
    const parameter = await findById(this.store.repo('parameters', session), request.parameterId);
    const versions = await this.store.repo('versions', session).find({ parameterId: parameter.id }, { sort: { versionNumber: -1 } });
    const current = effectiveVersion(versions, decidedAt);
    const baseVersion = current?.versionNumber ?? versions[0]?.versionNumber ?? null;
    if ((request.baseVersionNumber ?? null) !== baseVersion) fail(409, 'BASE_VERSION_MISMATCH', 'La versión base cambió.');
    validateRequest(parameter, request, versions, new Date(decidedAt));
    const start = request.effectiveFrom && request.effectiveFrom > decidedAt ? request.effectiveFrom : decidedAt;
    const overlapsSchedule = versions.some(version => version.effectiveFrom > decidedAt && (!request.effectiveTo || version.effectiveFrom < request.effectiveTo) && (!version.effectiveTo || version.effectiveTo > start));
    if (overlapsSchedule) fail(409, 'EFFECTIVE_PERIOD_CONFLICT', 'Existe una programación incompatible.');
    // Reactivation restores the latest published value; deactivation carries none.
    const value = request.changeType === 'SET_VALUE' ? request.proposedValue
      : request.changeType === 'REACTIVATE' ? versions.find(version => version.changeType === 'SET_VALUE')?.value
        : undefined;
    const version = {
      parameterId: parameter.id,
      versionNumber: (versions[0]?.versionNumber ?? 0) + 1,
      status: start > decidedAt ? 'SCHEDULED' : 'ACTIVE',
      changeType: request.changeType,
      ...(value === undefined ? {} : { value }),
      effectiveFrom: start,
      effectiveTo: request.effectiveTo ?? null,
      changeRequestId: request.id,
      reason: request.reason,
      createdBy: request.createdBy,
      approvedBy: context.actor,
      approvedAt: decidedAt
    };
    await this.store.repo('versions', session).insert(version);
    const takesEffectNow = start <= decidedAt;
    await this.store.repo('parameters', session).update({ id: parameter.id }, {
      $set: {
        updatedAt: decidedAt,
        updatedBy: context.actor,
        ...(takesEffectNow ? { currentVersionNumber: version.versionNumber, status: request.changeType === 'DEACTIVATE' ? 'INACTIVE' : 'ACTIVE' } : {})
      }
    });
    await this.audit.record(session, context, 'VERSION_PUBLISHED', 'PARAMETER_VERSION', request.id, parameter.id, { versionNumber: version.versionNumber });
    return version;
  }
}
