import express, { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../lib/auth.ts';
import { User } from '@shared/types/index.ts';

interface AuthenticatedRequest extends Request {
  user?: User;
}

const router = express.Router();

// All notification routes require authentication
router.use(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await requireAuth(req);
    req.user = user;
    next();
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Unauthorized' });
  }
});

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const handler = await import('../api/notifications/index.ts');
  return handler.default(req, res);
});

router.patch('/', async (req: AuthenticatedRequest, res: Response) => {
  const handler = await import('../api/notifications/index.ts');
  return handler.default(req, res);
});

router.get('/detail', async (req: AuthenticatedRequest, res: Response) => {
  const handler = await import('../api/notifications/detail.ts');
  return handler.default(req, res);
});

router.post('/mark-all', async (req: AuthenticatedRequest, res: Response) => {
  const handler = await import('../api/notifications/mark-all.ts');
  return handler.default(req, res);
});

router.post('/mock', async (req: AuthenticatedRequest, res: Response) => {
  const handler = await import('../api/notifications/mock.ts');
  return handler.default(req, res);
});

export default router;

