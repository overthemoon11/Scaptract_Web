import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import Notification from '../../models/supabase/Notification.ts';

export default async function handler(req: Request, res: Response) {
  await connectDB();
  const { id } = req.query;
  if (!id) return res.status(400).json(null);
  try {
    const notification = await Notification.findById(id as string);
    if (!notification) return res.status(404).json(null);
    return res.status(200).json({
      id: notification.id,
      _id: notification.id?.toString(),
      user_id: notification.user_id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      is_read: notification.is_read,
      read: notification.read,
      created_at: notification.created_at,
      createdAt: notification.created_at ? (typeof notification.created_at === 'string' ? notification.created_at : new Date(notification.created_at).toISOString()) : null,
      updatedAt: notification.created_at ? (typeof notification.created_at === 'string' ? notification.created_at : new Date(notification.created_at).toISOString()) : null
    });
  } catch (err) {
    res.status(500).json(null);
  }
}

