import { AuditService } from './modules/audit/audit.service.js';
import { AuthService } from './modules/auth/auth.service.js';
import { ChangeRequestsService } from './modules/change-requests/change-requests.service.js';
import { ParameterValuesService } from './modules/parameter-values/parameter-values.service.js';
import { ParametersService } from './modules/parameters/parameters.service.js';
import { VersionsService } from './modules/versions/versions.service.js';
import { IdempotencyService } from './shared/idempotency.js';

/** Builds every service with its dependencies over the given store. */
export function createServices(store, config) {
  const audit = new AuditService(store);
  const idempotency = new IdempotencyService(store);
  const versions = new VersionsService(store, audit);
  return {
    auth: new AuthService(store, config),
    audit,
    versions,
    parameters: new ParametersService(store, { audit, idempotency, versions }),
    changeRequests: new ChangeRequestsService(store, { audit, idempotency, versions }),
    parameterValues: new ParameterValuesService(store)
  };
}
