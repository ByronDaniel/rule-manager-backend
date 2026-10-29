import { Router } from 'express';

export function authRoutes({ auth }) {
  const router = Router();
  router.post('/auth/token', async (req, res) => res.json(await auth.issueToken(req.body.username, req.body.password)));
  return router;
}
