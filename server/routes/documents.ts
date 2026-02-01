import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../lib/auth.ts';
import { User } from '@shared/types/index.ts';

interface AuthenticatedRequest extends Request {
  user?: User;
}

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Only allow PDF and image files
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/bmp',
      'image/tiff',
      'image/gif',
      'image/webp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files (JPG, PNG, BMP, TIFF, GIF, WEBP) are supported'));
    }
  }
});

// Upload documents
router.post('/upload', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    
    // Use multer middleware - but don't process here, let the handler do it
    // The handler already has multer configured, so we just pass through
    try {
      const handler = await import('../api/documents/upload.ts');
      req.user = user;
      return handler.default(req, res);
    } catch (importErr) {
      console.error('Error importing upload handler:', importErr);
      res.status(500).json({ error: 'Internal server error' });
    }
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Unauthorized' });
  }
});

// Process document
router.post('/process', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/process.ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Extract document
router.get('/extract/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/extract/[id].ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Get OCR markdown files for a group
router.get('/ocr-markdown/:groupname', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/ocr-markdown/[groupname].ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Serve OCR images from ocr-results directory
// Use regex pattern to match everything after groupname
// The route is mounted at /api/documents, so we match /ocr-images/...
router.get(/^\/ocr-images\/([^/]+)\/(.+)$/, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/ocr-images/[groupname]/[...path].ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Download document
router.get('/download/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/download/[id].ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// OCR download endpoint (public, uses token-based authentication)
router.get('/ocr-download/:id', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/documents/ocr-download/[id].ts');
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// OCR info endpoint (internal, for OCR API to fetch document metadata)
router.get('/ocr-info/:id', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/documents/ocr-info/[id].ts');
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Get user documents
router.get('/user-documents', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/user-documents.ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Document comments
router.get('/comments/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/comments.ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/comments/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/comments.ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Start extraction (triggers workflow 1)
router.post('/start-extraction', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/start-extraction.ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Start OCR (calls OCR APIs directly - pdf-ocr-api.py or img-ocr-api.py)
router.post('/start-ocr', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/start-ocr.ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Convert markdown to JSON and store in structured_data
// Supports both individual extraction results (/convert-markdown-to-json/:id) 
// and group views (/convert-markdown-to-json/group?group_name=...)
router.post('/convert-markdown-to-json/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/convert-markdown-to-json/[id].ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// OCR callback endpoint (called by OCR APIs to update status)
router.post('/ocr-callback', async (req: Request, res: Response) => {
  try {
    const handler = await import('../api/documents/ocr-callback.ts');
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Delete documents by file_id (deletes all documents with the same file_id)
router.delete('/delete', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/delete.ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Save section order for structured data
router.post('/save-section-order/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/save-section-order.ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Summarize a section
router.post('/summarize-section/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/summarize-section.ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Get group extraction results
router.get('/group/:group_name', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/group/[group_name].ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

// Update group name
router.patch('/group/update-name', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await requireAuth(req);
    const handler = await import('../api/documents/group/update-name.ts');
    req.user = user;
    return handler.default(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

