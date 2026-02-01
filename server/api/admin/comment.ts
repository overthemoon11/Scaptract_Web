import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import Comment from '../../models/supabase/Comment.ts';

export default async function handler(req: Request, res: Response) {
  try {
    await requireAuth(req, 'admin');

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Comment ID is required' });
    }

    // Fetch comment
    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.status(200).json({
      comment: {
        id: comment.id?.toString() || '',
        content: comment.content,
        reply: comment.reply,
        document_id: comment.document_id?.toString() || ''
      }
    });
  } catch (err: any) {
    console.error('Error fetching comment:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch comment' });
  }
}
