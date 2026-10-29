import { Router } from 'express';
import { requestContext } from '../../http/context.js';
import { sendCreated, sendResource } from '../../http/responses.js';
import { catalogReaders, requireRoles } from '../auth/authorize.js';

const DECISIONS = [['approval', true], ['rejection', false]];

export function changeRequestsRoutes({ changeRequests }) {
  const router = Router();
  router.get('/change-requests', catalogReaders, async (req, res) => res.json(await changeRequests.list(req.query, requestContext(req))));
  router.post('/change-requests', requireRoles('MAKER'), async (req, res) => sendCreated(res, await changeRequests.create(req.body, requestContext(req))));
  router.get('/change-requests/:id', catalogReaders, async (req, res) => sendResource(req, res, await changeRequests.getVisible(req.params.id, requestContext(req))));
  router.delete('/change-requests/:id', requireRoles('MAKER'), async (req, res) => {
    await changeRequests.cancel(req.params.id, requestContext(req));
    res.status(204).end();
  });
  for (const [path, approved] of DECISIONS) {
    router.get(`/change-requests/:id/${path}`, catalogReaders, async (req, res) => res.json(await changeRequests.getDecision(req.params.id, approved, requestContext(req))));
    router.post(`/change-requests/:id/${path}`, requireRoles('CHECKER'), async (req, res) => sendCreated(res, await changeRequests.decide(req.params.id, approved, req.body ?? {}, requestContext(req))));
  }
  return router;
}
