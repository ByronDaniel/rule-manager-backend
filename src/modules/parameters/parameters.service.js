import { randomUUID } from 'node:crypto';
import { fail } from '../../shared/errors.js';
import { etag, requireMatch } from '../../shared/etag.js';
import { findById, listPage, pick } from '../../shared/queries.js';
import { now } from '../../shared/time.js';
import { validateConstraints, validateValue } from './parameter.rules.js';

/** Parameter definitions (metadata). Values change only through approved change requests. */
export class ParametersService {
  constructor(store, { audit, idempotency, versions }) {
    this.store = store;
    this.audit = audit;
    this.idempotency = idempotency;
    this.versions = versions;
  }

  async list(query) {
    await this.versions.synchronizeAll();
    const filter = pick(query, ['code', 'category', 'businessDomain', 'status']);
    const result = await listPage(this.store.repo('parameters'), filter, query, 'code,asc');
    return { ...result, items: await this.versions.withCurrentValues(result.items) };
  }

  async get(id) {
    await this.versions.synchronizeParameter(id);
    return findById(this.store.repo('parameters'), id);
  }

  async create(body, context) {
    validateConstraints(body.constraints);
    return this.idempotency.run(context, 'createParameter', async session => {
      const parameters = this.store.repo('parameters', session);
      if (await parameters.findOne({ code: body.code })) fail(409, 'DUPLICATE_CODE', 'El código ya existe.');
      const parameter = { ...body, id: randomUUID(), status: 'DRAFT', currentVersionNumber: null, createdAt: now(), createdBy: context.actor };
      await parameters.insert(parameter);
      await this.audit.record(session, context, 'PARAMETER_CREATED', 'PARAMETER', parameter.id, parameter.id);
      return { status: 201, body: parameter, headers: { ETag: etag(parameter), Location: `/api/v1/parameters/${parameter.id}` } };
    });
  }

  /** Replaces the editable metadata; identity, type, scope and publication state are kept. */
  async update(id, body, context) {
    validateConstraints(body.constraints);
    return this.store.transaction(async session => {
      const parameters = this.store.repo('parameters', session);
      const parameter = await findById(parameters, id);
      requireMatch(context.match, parameter);
      // New constraints must still accept every value already published.
      const versions = await this.store.repo('versions', session).find({ parameterId: id });
      for (const version of versions) if (Object.hasOwn(version, 'value')) validateValue(parameter.dataType, version.value, body.constraints);
      const updated = {
        id,
        code: parameter.code,
        dataType: parameter.dataType,
        ...(parameter.scope ? { scope: parameter.scope } : {}),
        ...body,
        status: parameter.status,
        currentVersionNumber: parameter.currentVersionNumber,
        createdAt: parameter.createdAt,
        createdBy: parameter.createdBy,
        updatedAt: now(),
        updatedBy: context.actor
      };
      await parameters.replace({ id }, updated);
      await this.audit.record(session, context, 'PARAMETER_UPDATED', 'PARAMETER', id, id);
      return updated;
    });
  }

  /** Logical delete, only for drafts that were never published. */
  async retire(id, context) {
    return this.store.transaction(async session => {
      const parameters = this.store.repo('parameters', session);
      const parameter = await findById(parameters, id);
      requireMatch(context.match, parameter);
      if (parameter.status !== 'DRAFT' || await this.store.repo('versions', session).findOne({ parameterId: id })) fail(409, 'PARAMETER_PUBLISHED', 'Solo se pueden retirar borradores sin publicar.');
      await parameters.update({ id }, { $set: { status: 'INACTIVE', updatedAt: now(), updatedBy: context.actor } });
      await this.audit.record(session, context, 'PARAMETER_RETIRED', 'PARAMETER', id, id);
    });
  }
}
