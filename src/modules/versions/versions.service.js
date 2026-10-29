import { randomUUID } from 'node:crypto';
import { findById, listPage } from '../../shared/queries.js';
import { now } from '../../shared/time.js';
import { effectiveVersion, parameterStatusAt, versionStatusAt } from './version.rules.js';

/** Keeps version and parameter statuses in line with the effective dates, and serves the version history. */
export class VersionsService {
  constructor(store, audit) {
    this.store = store;
    this.audit = audit;
  }

  /** Applies scheduled activations and expirations of one parameter inside the caller's transaction. */
  async synchronize(parameterId, session) {
    const parameters = this.store.repo('parameters', session);
    const parameter = await parameters.findOne({ id: parameterId });
    if (!parameter) return;
    const versions = await this.store.repo('versions', session).find({ parameterId });
    if (!versions.length) return;
    const instant = now();
    const current = effectiveVersion(versions, instant);
    const system = { actor: 'system', actorType: 'SYSTEM', roles: [], correlationId: randomUUID() };
    for (const version of versions) {
      const expected = versionStatusAt(version, current, instant);
      if (expected === version.status) continue;
      await this.store.repo('versions', session).update({ parameterId, versionNumber: version.versionNumber }, { $set: { status: expected } });
      if (expected !== 'SCHEDULED') {
        const operation = expected === 'ACTIVE' ? 'VERSION_ACTIVATED' : 'VERSION_EXPIRED';
        await this.audit.record(session, system, operation, 'PARAMETER_VERSION', version.changeRequestId, parameterId, { versionNumber: version.versionNumber });
      }
    }
    const nextStatus = parameterStatusAt(current, versions, instant);
    const nextVersion = current?.versionNumber ?? null;
    if (parameter.status !== nextStatus || parameter.currentVersionNumber !== nextVersion) {
      await parameters.update({ id: parameterId }, { $set: { status: nextStatus, currentVersionNumber: nextVersion, updatedAt: instant, updatedBy: 'system' } });
    }
  }

  /** Synchronizes one parameter in its own transaction. */
  synchronizeParameter(parameterId) {
    return this.store.transaction(session => this.synchronize(parameterId, session));
  }

  async synchronizeAll() {
    const parameters = await this.store.repo('parameters').find();
    for (const parameter of parameters) await this.synchronizeParameter(parameter.id);
  }

  /** Published versions of a parameter, newest approval first. */
  async history(parameterId, query) {
    await this.synchronizeParameter(parameterId);
    await findById(this.store.repo('parameters'), parameterId);
    return listPage(this.store.repo('versions'), { parameterId }, query, 'approvedAt,desc');
  }

  /** Adds the value of each parameter's current version, read with a single query. Not stored. */
  async withCurrentValues(parameters) {
    const current = parameters.filter(parameter => parameter.currentVersionNumber);
    if (!current.length) return parameters;
    const versions = await this.store.repo('versions').find({ $or: current.map(parameter => ({ parameterId: parameter.id, versionNumber: parameter.currentVersionNumber })) });
    const values = new Map(versions.filter(version => Object.hasOwn(version, 'value')).map(version => [version.parameterId, version.value]));
    return parameters.map(parameter => (values.has(parameter.id) ? { ...parameter, currentValue: values.get(parameter.id) } : parameter));
  }
}
