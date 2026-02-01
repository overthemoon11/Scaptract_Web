import express, { Request, Response } from 'express';
import { requireAuth } from '../lib/auth.ts';

const router = express.Router();

// All admin routes require admin role
router.use(async (req: Request, res: Response, next) => {
  try {
    await requireAuth(req, 'admin');
    next();
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Unauthorized' });
  }
});

// Dashboard
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/dashboard.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// FAQ routes
router.get('/faq', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/faq.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/faq', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/faq.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/faq', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/faq.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/faq', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/faq.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all admins
router.get('/admins', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/admins.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/users.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ban user/admin
router.post('/user/:id/ban', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/user-ban.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Activate user/admin
router.post('/user/:id/activate', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/user-activate.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all documents
router.get('/documents', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/documents.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get/Update single document
router.get('/document/:id', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/document/[id].ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/document/:id', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/document/[id].ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get document comments
router.get('/document/comments/:id', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/document-comments.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single comment
router.get('/comment/:id', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/comment.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update comment reply
router.post('/comment/:id/reply', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/comment-reply.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all support tickets
router.get('/support-tickets', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/support-tickets.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update support ticket status
router.put('/support-ticket/:id/status', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/support-ticket-status.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analytics
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/analytics/index.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analytics Export
router.get('/analytics/export', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/analytics/export.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Backfill extracted_text for existing documents
router.post('/backfill-extracted-text', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/admin/backfill-extracted-text.ts');
    return handler.default(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

