import 'dotenv/config';

export function loadConfig(environment = process.env) {
  if (!environment.MONGODB_URI || !environment.JWT_SECRET || environment.JWT_SECRET.length < 32) throw new Error('MONGODB_URI and a JWT_SECRET of at least 32 characters are required');
  return {
    mongoUri: environment.MONGODB_URI,
    mongoDatabase: environment.MONGODB_DATABASE || 'rma',
    jwtSecret: environment.JWT_SECRET,
    jwtIssuer: environment.JWT_ISSUER || 'rma-service',
    jwtAudience: environment.JWT_AUDIENCE || 'rma-clients',
    jwtExpiresIn: Number(environment.JWT_EXPIRES_IN || 3600),
    corsOrigin: environment.CORS_ORIGIN || 'http://localhost:4200',
    port: Number(environment.PORT || 3000)
  };
}