import express, { Request, Response } from 'express';
import ocrWebhookHandler, { workflow2CallbackHandler } from '../api/ocr-webhook.ts';

const router = express.Router();

// Webhook endpoint to receive OCR callbacks (for logging/error handling only)
// NOTE: OCR API should call Workflow 2's webhook directly, not this endpoint
// This is kept for backward compatibility and error handling
router.post('/', ocrWebhookHandler);

// Webhook endpoint for Workflow 2 to call back with structured_data and combined_text
// This is the main endpoint that receives final results from Workflow 2
router.post('/workflow2-callback', workflow2CallbackHandler);

// Deprecated endpoints (kept for backward compatibility but return 410 Gone)
// Batch processing is now handled by Workflow 2 using Supabase
router.get('/process-batch/:batch_id', (req: Request, res: Response) => {
  res.status(410).json({ 
    error: 'This endpoint is deprecated',
    message: 'Batch processing is now handled by Workflow 2 using Supabase'
  });
});

router.get('/batch/:batch_id', (req: Request, res: Response) => {
  res.status(410).json({ 
    error: 'This endpoint is deprecated',
    message: 'Batch status is now tracked in Supabase by Workflow 2'
  });
});

export default router;
