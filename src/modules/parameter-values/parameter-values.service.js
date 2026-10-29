import { Problem, fail } from '../../shared/errors.js';
import { page, pick } from '../../shared/queries.js';
import { effectiveVersion } from '../versions/version.rules.js';

const SCOPE_KEYS = ['channel', 'product', 'segment'];
const DEFAULT_PAGE_SIZE = 50;

/** Read-only projection of the values in force, for consumer applications. */
export class ParameterValuesService {
  constructor(store) {
    this.store = store;
  }

  /**
   * Values in force that match the filters. A scope filter also matches parameters without that scope key.
   * When `codes` is given, the requested codes that cannot be served are listed in `unavailable`.
   */
  async list(query) {
    const codes = query.codes ? (Array.isArray(query.codes) ? query.codes : String(query.codes).split(',')) : null;
    const filter = pick(query, ['category', 'businessDomain']);
    const scopeFilters = SCOPE_KEYS.filter(key => query[key]).map(key => ({ $or: [{ [`scope.${key}`]: query[key] }, { [`scope.${key}`]: { $exists: false } }] }));
    if (scopeFilters.length) filter.$and = scopeFilters;
    if (codes) filter.code = { $in: codes };
    const parameters = await this.store.repo('parameters').find(filter, { sort: { code: 1 } });
    const items = [];
    const unavailable = [];
    for (const parameter of parameters) {
      try { items.push(await this.currentValue(parameter)); }
      catch (error) {
        if (!(error instanceof Problem) || error.status !== 404) throw error;
        if (codes) unavailable.push({ code: parameter.code, reason: error.code === 'PARAMETER_INACTIVE' ? 'INACTIVE' : 'NOT_EFFECTIVE' });
      }
    }
    if (codes) for (const code of codes) if (!parameters.some(parameter => parameter.code === code)) unavailable.push({ code, reason: 'NOT_FOUND' });
    const number = Number(query.page ?? 0);
    const size = Number(query.size ?? DEFAULT_PAGE_SIZE);
    const result = page(items.slice(number * size, (number + 1) * size), number, size, items.length);
    if (codes) result.unavailable = unavailable;
    return result;
  }

  async get(code) {
    const parameter = await this.store.repo('parameters').findOne({ code });
    if (!parameter) fail(404, 'PARAMETER_NOT_FOUND', 'El parámetro no existe.');
    return this.currentValue(parameter);
  }

  /** Value in force for a parameter; 404 if it is inactive or has no effective version. */
  async currentValue(parameter) {
    const versions = await this.store.repo('versions').find({ parameterId: parameter.id });
    if (!versions.length && parameter.status === 'INACTIVE') fail(404, 'PARAMETER_INACTIVE', 'El parámetro está inactivo.');
    const version = effectiveVersion(versions);
    if (!version) fail(404, 'PARAMETER_NOT_EFFECTIVE', 'El parámetro no tiene una versión vigente.');
    if (version.changeType === 'DEACTIVATE') fail(404, 'PARAMETER_INACTIVE', 'El parámetro está inactivo.');
    return {
      code: parameter.code,
      dataType: parameter.dataType,
      value: version.value,
      ...(parameter.unit ? { unit: parameter.unit } : {}),
      ...(parameter.scope ? { scope: parameter.scope } : {}),
      versionNumber: version.versionNumber,
      effectiveFrom: version.effectiveFrom,
      effectiveTo: version.effectiveTo
    };
  }
}
