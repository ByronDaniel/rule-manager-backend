import { Router } from 'express';
import { requestContext } from '../../http/context.js';
import { sendCreated, sendResource } from '../../http/responses.js';
import { catalogReaders, catalogWriters } from '../auth/authorize.js';

export function parametersRoutes({ parameters }) {
  const router = Router();
  router.get('/parameters', catalogReaders, async (req, res) => res.json(await parameters.list(req.query)));
  router.post('/parameters', catalogWriters, async (req, res) => sendCreated(res, await parameters.create(req.body, requestContext(req))));
  router.get('/parameters/:id', catalogReaders, async (req, res) => sendResource(req, res, await parameters.get(req.params.id)));
  router.put('/parameters/:id', catalogWriters, async (req, res) => sendResource(req, res, await parameters.update(req.params.id, req.body, requestContext(req))));
  router.delete('/parameters/:id', catalogWriters, async (req, res) => {
    await parameters.retire(req.params.id, requestContext(req));
    res.status(204).end();
  });
  return router;
}
