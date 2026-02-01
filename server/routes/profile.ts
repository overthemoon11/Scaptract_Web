import express, { Request, Response } from 'express';
import { requireAuth } from '../lib/auth.ts';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req);
    res.status(200).json({ user });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Unauthorized' });
  }
});

// Profile image upload route
router.post('/upload-image', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/profile/upload-image.ts');
    return handler.default(req, res);
  } catch (err: any) {
    console.error('Error importing upload-image handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

