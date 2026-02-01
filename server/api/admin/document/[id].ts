import { Request, Response } from 'express';
import { requireAuth } from '../../../lib/auth.ts';
import { connectDB } from '../../../lib/supabase.ts';
import ExtractionResult from '../../../models/supabase/ExtractionResult.ts';
import Document from '../../../models/supabase/Document.ts';

/**
 * Get a single document with extraction result for admin edit
 * GET /api/admin/document/:id
 */
export async function getDocument(req: Request, res: Response) {
  try {
    await requireAuth(req, 'admin');
    await connectDB();

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    // Get document
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get extraction result
    const extractionResult = await ExtractionResult.getByDocumentId(id);

    return res.status(200).json({
      success: true,
      document: {
        id: document.id?.toString() || '',
        original_name: document.original_name,
        file_name: document.file_name,
        file_path: document.file_path,
        mime_type: document.mime_type,
        status: document.status || 'uploaded',
        page_count: document.page_count || 0,
        group_name: document.group_name || null,
        display_name: document.display_name || null,
        created_at: document.created_at || null,
        updated_at: document.updated_at || null,
        extracted_text: extractionResult?.extracted_text || null,
        structured_data: extractionResult?.structured_data || null
      }
    });
  } catch (error: any) {
    console.error('Error fetching document:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to fetch document'
    });
  }
}

/**
 * Update document's extracted_text and structured_data
 * PUT /api/admin/document/:id
 */
export async function updateDocument(req: Request, res: Response) {
  try {
    await requireAuth(req, 'admin');
    await connectDB();

    const { id } = req.params;
    const { extracted_text, structured_data } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    // Verify document exists
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get extraction result
    const extractionResult = await ExtractionResult.getByDocumentId(id);
    if (!extractionResult) {
      return res.status(404).json({ error: 'Extraction result not found' });
    }

    // Update extraction result
    const updateData: any = {};
    if (extracted_text !== undefined) {
      updateData.extracted_text = extracted_text;
    }
    if (structured_data !== undefined) {
      updateData.structured_data = structured_data;
    }

    await ExtractionResult.update(extractionResult.id!.toString(), updateData);

    return res.status(200).json({
      success: true,
      message: 'Document updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating document:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to update document'
    });
  }
}

export default async function handler(req: Request, res: Response) {
  if (req.method === 'GET') {
    return getDocument(req, res);
  } else if (req.method === 'PUT') {
    return updateDocument(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
