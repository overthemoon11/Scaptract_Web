import express, { Request, Response } from 'express';
import { requireAuth } from '../lib/auth.ts';
import { User } from '@shared/types/index.ts';

interface AuthenticatedRequest extends Request {
  user?: User;
}

const router = express.Router();

// Public FAQ endpoint - no authentication required
router.get('/faq', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/support/faq.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/ticket', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/support/ticket.ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Unauthorized' });
  }
});

export default router;

