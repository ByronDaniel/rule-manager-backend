import rateLimit from 'express-rate-limit';

/** Limits login attempts per client. The counter is in memory, one per app instance. */
export function loginRateLimit() {
  return rateLimit({
    windowMs: 60000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).type('application/problem+json').json({
      type: 'https://api.banco.example/problems/rate-limit',
      title: 'Demasiadas solicitudes',
      status: 429,
      businessCode: 'RATE_LIMITED',
      correlationId: req.correlationId
    })
  });
}
