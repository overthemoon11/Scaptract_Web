import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import Comment from '../../models/supabase/Comment.ts';
import Document from '../../models/supabase/Document.ts';

export default async function handler(req: Request, res: Response) {
  try {
    await requireAuth(req, 'admin');

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    // Fetch document
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Fetch comments for this document
    const comments = await Comment.findByDocumentId(id);

    return res.status(200).json({
      document: {
        id: document.id?.toString() || '',
        file_name: document.file_name,
        original_name: document.original_name
      },
      comments: comments.map(c => ({
        id: c.id?.toString() || '',
        content: c.content,
        reply: c.reply,
        document_id: c.document_id?.toString() || '',
        created_at: c.created_at || null
      }))
    });
  } catch (err: any) {
    console.error('Error fetching document comments:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch comments' });
  }
}
