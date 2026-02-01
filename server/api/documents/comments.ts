import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import Comment from '../../models/supabase/Comment.ts';
import Document from '../../models/supabase/Document.ts';

export default async function handler(req: Request, res: Response) {
  try {
    const user = await requireAuth(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    if (req.method === 'GET') {
      // Fetch comments for this document
      const comments = await Comment.findByDocumentId(id);

      return res.status(200).json({
        success: true,
        comments: comments.map(c => ({
          id: c.id?.toString() || '',
          content: c.content,
          reply: c.reply,
          document_id: c.document_id?.toString() || '',
          user_id: c.user_id?.toString() || '',
          user_name: c.user_name || 'Unknown',
          created_at: c.created_at || null
        }))
      });
    } else if (req.method === 'POST') {
      // Create a new comment
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Comment content is required' });
      }

      // Verify document exists and belongs to user
      const document = await Document.findById(id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Create comment
      const userId = user.id?.toString() || user._id?.toString() || '';
      const commentId = await Comment.create({
        user_id: userId,
        document_id: id,
        content: content.trim()
      });

      // Fetch the created comment
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(500).json({ error: 'Failed to create comment' });
      }

      return res.status(201).json({
        success: true,
        comment: {
          id: comment.id?.toString() || '',
          content: comment.content,
          reply: comment.reply,
          document_id: comment.document_id?.toString() || '',
          user_id: comment.user_id?.toString() || '',
          user_name: user.name || 'Unknown',
          created_at: comment.created_at || null
        }
      });
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (err: any) {
    console.error('Error in document comments handler:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
}
