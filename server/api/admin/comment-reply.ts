import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import Comment from '../../models/supabase/Comment.ts';
import Document from '../../models/supabase/Document.ts';
import Notification from '../../models/supabase/Notification.ts';

export default async function handler(req: Request, res: Response) {
  try {
    await requireAuth(req, 'admin');

    const { id } = req.params;
    const { reply } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Comment ID is required' });
    }

    if (!reply || !reply.trim()) {
      return res.status(400).json({ error: 'Reply is required' });
    }

    // Check if comment exists
    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if this is a new reply or an update to existing reply
    const isNewReply = !comment.reply;

    // Update comment with reply
    await Comment.addReply(id, reply.trim());

    // Create notification for the user who made the comment
    // Only send notification for new replies (not when updating existing replies)
    if (isNewReply) {
      try {
        // Get document info for the notification message
        const document = await Document.findById(comment.document_id);
        const documentName = document?.display_name || document?.group_name || document?.original_name || document?.file_name || 'your document';
        
        // Truncate reply for notification (first 100 chars)
        const replyPreview = reply.trim().length > 100 
          ? reply.trim().substring(0, 100) + '...' 
          : reply.trim();

        await Notification.create({
          user_id: comment.user_id,
          title: 'Admin Response to Your Comment',
          message: `An admin has responded to your comment on "${documentName}". Reply: "${replyPreview}"`,
          is_read: false
        });

        console.log(`🔔 Sent notification to user ${comment.user_id} for comment reply on document ${comment.document_id}`);
      } catch (notificationError: any) {
        console.error(`⚠️ Failed to create notification for comment reply: ${notificationError.message}`);
        // Don't fail the whole operation if notification creation fails
      }
    } else {
      console.log(`ℹ️ Comment ${id} already had a reply, skipping notification (reply update)`);
    }

    return res.status(200).json({
      success: true,
      message: 'Reply updated successfully'
    });
  } catch (err: any) {
    console.error('Error updating comment reply:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update reply' });
  }
}
