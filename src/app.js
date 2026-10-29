import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { correlationId } from './http/correlation-id.js';
import { errorHandler } from './http/error-handler.js';
import { validateContract } from './http/openapi.js';
import { requireIfMatch } from './http/preconditions.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { authenticate } from './modules/auth/authenticate.js';
import { loginRateLimit } from './modules/auth/login-rate-limit.js';
import { changeRequestsRoutes } from './modules/change-requests/change-requests.routes.js';
import { parameterValuesRoutes } from './modules/parameter-values/parameter-values.routes.js';
import { parametersRoutes } from './modules/parameters/parameters.routes.js';
import { versionsRoutes } from './modules/versions/versions.routes.js';
import { createServices } from './services.js';

const API = '/api/v1';

export function createApp(store, config) {
  const services = createServices(store, config);
  const app = express();
  app.disable('x-powered-by');

  // Order matters: authentication (401) and If-Match (428) are checked before contract validation (400).
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, exposedHeaders: ['ETag', 'Location', 'X-Correlation-Id'] }));
  app.use(express.json({ limit: '128kb' }));
  app.use(correlationId);
  app.use(`${API}/auth/token`, loginRateLimit());
  app.use(authenticate(config));
  app.use(requireIfMatch);
  app.use(validateContract());

  app.use(
    API,
    authRoutes(services),
    parametersRoutes(services),
    versionsRoutes(services),
    changeRequestsRoutes(services),
    parameterValuesRoutes(services),
    auditRoutes(services)
  );

  app.use(errorHandler);
  return app;
}
