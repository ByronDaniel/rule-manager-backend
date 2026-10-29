import { Router } from 'express';
import { catalogReaders } from '../auth/authorize.js';

export function versionsRoutes({ versions }) {
  const router = Router();
  router.get('/parameters/:id/versions', catalogReaders, async (req, res) => res.json(await versions.history(req.params.id, req.query)));
  return router;
}
