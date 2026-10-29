import jwt from 'jsonwebtoken';

export function signToken(user, config) {
  return jwt.sign({ roles: user.roles }, config.jwtSecret, {
    subject: user.username,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    expiresIn: config.jwtExpiresIn,
    algorithm: 'HS256'
  });
}

/** Returns the token claims; throws if the token is invalid or expired. */
export function verifyToken(token, config) {
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: config.jwtIssuer, audience: config.jwtAudience });
}
