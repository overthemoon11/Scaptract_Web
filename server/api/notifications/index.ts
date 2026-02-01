import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import Notification from '../../models/supabase/Notification.ts';

export default async function handler(req: Request, res: Response) {
  await connectDB();
  const { userId } = req.query;
  if (req.method === 'GET') {
    if (!userId) return res.status(400).json([]);
    try {
      const notifications = await Notification.findByUserId(userId as string);
      // Explicitly serialize to ensure both is_read and read are included
      const serialized = notifications.map(n => ({
        id: n.id,
        _id: n.id?.toString(),
        user_id: n.user_id,
        title: n.title,
        message: n.message,
        type: n.type,
        is_read: n.is_read,
        read: n.read,
        created_at: n.created_at
      }));
      res.status(200).json(serialized);
    } catch (err) {
      res.status(500).json([]);
    }
  } else if (req.method === 'PATCH') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing notification id' });
    try {
      await Notification.markAsRead(id);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to mark notification as read.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PATCH']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

