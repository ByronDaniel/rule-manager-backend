import { randomUUID } from 'node:crypto';
import { fail } from '../../shared/errors.js';
import { findById, listPage, pick } from '../../shared/queries.js';
import { now } from '../../shared/time.js';

export class AuditService {
  constructor(store) {
    this.store = store;
  }

  /** Records a successful operation inside the caller's transaction. */
  async record(session, context, operation, resourceType, resourceId, parameterId, extra = {}) {
    await this.store.repo('audit', session).insert({
      id: randomUUID(),
      occurredAt: now(),
      actor: { id: context.actor, type: context.actorType ?? 'USER', roles: context.roles },
      operation,
      resourceType,
      resourceId,
      ...(parameterId ? { parameterId } : {}),
      outcome: 'SUCCESS',
      correlationId: context.correlationId,
      ...extra
    });
  }

  async list(query) {
    if (!query.parameterId && !query.from && !query.to) fail(400, 'FILTER_REQUIRED', 'Debe indicar un parámetro o un filtro temporal.');
    const filter = pick(query, ['parameterId', 'operation', 'outcome', 'correlationId']);
    if (query.actor) filter['actor.id'] = query.actor;
    if (query.from || query.to) filter.occurredAt = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
    return listPage(this.store.repo('audit'), filter, query, 'occurredAt,desc');
  }

  get(id) {
    return findById(this.store.repo('audit'), id);
  }
}
