import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import ExtractionResult from '../../models/supabase/ExtractionResult.ts';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';

/**
 * Save section order for a document's extraction result
 * POST /api/documents/save-section-order/:id
 * Body: { sectionOrder: string[] }
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    // Verify JWT token from cookies
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.token;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: number | string };
    const userId = decoded.userId;

    const { id } = req.params; // document_id
    const { sectionOrder } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    if (!sectionOrder || !Array.isArray(sectionOrder)) {
      return res.status(400).json({ error: 'sectionOrder must be an array' });
    }

    // Get extraction result for this document
    const extractionResult = await ExtractionResult.getByDocumentId(id);

    if (!extractionResult) {
      return res.status(404).json({ error: 'Extraction result not found' });
    }

    // Verify user owns the document (through extraction_result -> document)
    // We need to check document ownership
    const { getConnection } = await import('../../lib/supabase.ts');
    const supabase = getConnection();
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('user_id')
      .eq('id', id)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.user_id !== String(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get current structured_data
    let structuredData: any = extractionResult.structured_data;
    if (typeof structuredData === 'string') {
      structuredData = JSON.parse(structuredData);
    }

    // Update structured_data with sectionOrder at root level (camelCase)
    // Format: { "Title": { "Section1": "...", ... }, "sectionOrder": [...] }
    // Remove old snake_case if exists for consistency
    if (structuredData.section_order) {
      delete structuredData.section_order;
    }
    structuredData.sectionOrder = sectionOrder;

    // Save updated structured_data
    await ExtractionResult.update(extractionResult.id!, {
      structured_data: structuredData
    });

    return res.status(200).json({
      success: true,
      message: 'Section order saved successfully',
      sectionOrder
    });

  } catch (error: any) {
    console.error('Error saving section order:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
