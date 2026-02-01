import express, { Request, Response } from 'express';
import * as ocrPagesHandlers from '../api/ocr-pages.ts';

const router = express.Router();

// Store an OCR page
router.post('/', ocrPagesHandlers.storePage);

// Get all pages for a batch
router.get('/:batch_id', ocrPagesHandlers.getPages);

// Get batch status (check if all pages received)
router.get('/:batch_id/status', ocrPagesHandlers.getBatchStatus);

export default router;
