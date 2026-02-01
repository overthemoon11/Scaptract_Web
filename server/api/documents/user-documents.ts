import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import Document from '../../models/supabase/Document.ts';

export default async function handler(req: Request, res: Response) {
  try {
    const user = await requireAuth(req);
    
    // Get pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10; // Allow custom limit, default to 10
    const offset = (page - 1) * limit;

    const userId = user.id?.toString() || user._id?.toString() || '';
    
    // Fetch documents for the user
    const documents = await Document.findByUserId(userId, limit, offset);
    
    // Get total count - fetch all to count (could be optimized with a count query)
    // Use a large limit to get all documents for accurate count
    const allDocuments = await Document.findByUserId(userId, 10000, 0);
    const totalDocuments = allDocuments.length;
    const totalPages = limit > 0 ? Math.ceil(totalDocuments / limit) : 1;

    return res.status(200).json({
      documents: documents.map(doc => ({
        id: doc.id?.toString() || '',
        original_name: doc.original_name,
        file_name: doc.file_name,
        file_id: doc.file_id || null,
        group_name: doc.group_name || null,
        display_name: doc.display_name || null,
        mime_type: doc.mime_type,
        page_count: doc.page_count || 0,
        status: doc.status || 'uploaded',
        file_type_name: doc.file_type_name || null,
        created_at: doc.created_at || null,
        updated_at: doc.updated_at || null
      })),
      totalDocuments,
      currentPage: page,
      totalPages
    });
  } catch (err: any) {
    console.error('Error fetching user documents:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch documents' });
  }
}
