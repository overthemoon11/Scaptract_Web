import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import Notification from '../../models/supabase/Notification.ts';

interface AuthenticatedRequest extends Request {
  user?: {
    _id?: string;
    id?: string | number;
  };
}

export default async function handler(req: AuthenticatedRequest, res: Response) {
  await connectDB();
  // Try to get userId from authenticated user first, then from query/body
  const userId = req.user?._id || req.user?.id || req.body.userId || req.query.userId;
  
  if (!userId) {
    console.error('Missing userId in mark-all request:', { 
      hasUser: !!req.user, 
      user: req.user, 
      body: req.body, 
      query: req.query 
    });
    return res.status(400).json({ error: 'Missing userId' });
  }
  
  // Convert userId to string to ensure consistency
  const userIdStr = userId.toString();
  
  try {
    console.log('Marking all notifications as read for userId:', userIdStr);
    await Notification.markAllAsRead(userIdStr);
    console.log('Successfully marked all notifications as read');
    res.status(200).json({ ok: true, userId: userIdStr });
  } catch (err: any) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: err.message || 'Failed to mark as read.' });
  }
}

