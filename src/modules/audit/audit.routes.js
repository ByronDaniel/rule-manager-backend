import { Router } from 'express';
import { requireRoles } from '../auth/authorize.js';

export function auditRoutes({ audit }) {
  const router = Router();
  const auditors = requireRoles('AUDITOR', 'ADMIN');
  router.get('/audit-events', auditors, async (req, res) => res.json(await audit.list(req.query)));
  router.get('/audit-events/:id', auditors, async (req, res) => res.json(await audit.get(req.params.id)));
  return router;
}
