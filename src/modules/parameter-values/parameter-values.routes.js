import { Router } from 'express';
import { sendResource } from '../../http/responses.js';
import { requireRoles } from '../auth/authorize.js';

export function parameterValuesRoutes({ parameterValues }) {
  const router = Router();
  const consumers = requireRoles('CONSUMER');
  router.get('/parameter-values', consumers, async (req, res) => {
    const result = await parameterValues.list(req.query);
    res.set('Cache-Control', 'private, max-age=0, must-revalidate');
    sendResource(req, res, result);
  });
  router.get('/parameter-values/:code', consumers, async (req, res) => sendResource(req, res, await parameterValues.get(req.params.code)));
  return router;
}
