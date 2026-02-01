import { Request, Response } from 'express';
import { connectDB } from '../../../lib/supabase.ts';
import Document from '../../../models/supabase/Document.ts';

/**
 * Internal endpoint for OCR API to fetch document group_name and file_name
 * Uses simple token-based authentication (shared secret from environment)
 * This endpoint is called by the OCR API (Python service) to get document metadata
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    // Simple token-based authentication for internal OCR API calls
    const internalToken = req.query.token as string;
    const expectedToken = process.env.OCR_INTERNAL_TOKEN || 'ocr-internal-secret';

    if (!internalToken || internalToken !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    // Get document (no user ownership check needed for internal API)
    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Return only the fields needed by OCR API
    return res.status(200).json({
      success: true,
      document: {
        id: document.id?.toString() || '',
        group_name: document.group_name || null,
        file_name: document.file_name || null
      }
    });

  } catch (error: any) {
    console.error('Error fetching OCR document info:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
