import { createHash } from 'node:crypto';
import { fail } from './errors.js';

const RETENTION_MS = 86400000;
const DUPLICATE_KEY = 11000;

/** Ensures a write sent again with the same Idempotency-Key returns the first response instead of repeating it. */
export class IdempotencyService {
  constructor(store) {
    this.store = store;
  }

  /** Runs `callback` in a transaction once per actor and key; the stored response is replayed afterwards. */
  async run(context, action, callback) {
    const fingerprint = createHash('sha256').update(JSON.stringify({ action, body: context.body ?? null, match: context.match ?? null })).digest('hex');
    const key = context.key;
    try {
      return await this.store.transaction(async session => {
        const repository = this.store.repo('idempotency', session);
        const existing = await repository.findOne({ actor: context.actor, key });
        if (existing) return replay(existing, fingerprint);
        const response = await callback(session);
        await repository.insert({ actor: context.actor, key, fingerprint, response, expiresAt: new Date(Date.now() + RETENTION_MS) });
        return response;
      });
    } catch (error) {
      // A concurrent request with the same key committed first.
      if (error.code !== DUPLICATE_KEY) throw error;
      const existing = await this.store.repo('idempotency').findOne({ actor: context.actor, key });
      if (!existing) throw error;
      return replay(existing, fingerprint);
    }
  }
}

function replay(existing, fingerprint) {
  if (existing.fingerprint !== fingerprint) fail(422, 'IDEMPOTENCY_KEY_REUSED', 'La clave ya fue utilizada para otra solicitud.');
  return existing.response;
}
