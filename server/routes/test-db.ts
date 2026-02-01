import express, { Request, Response } from 'express';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/test-db.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

