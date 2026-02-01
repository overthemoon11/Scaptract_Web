import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import Notification from '../../models/supabase/Notification.ts';

export default async function handler(req: Request, res: Response) {
  await connectDB();
  const userId = req.body.userId || req.query.userId;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    await Notification.create({
      user_id: userId as string,
      title: 'Document Processed',
      message: 'Your document Image Extraction System.pdf is done.',
      is_read: false
    });
    await Notification.create({
      user_id: userId as string,
      title: 'Document Failed',
      message: 'Your document Image Extraction System.jpg is failed. Low-contrast image detected.',
      is_read: false
    });
    await Notification.create({
      user_id: userId as string,
      title: 'Document Processed',
      message: 'Your document Image Extraction System.pdf is done.',
      is_read: false
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to insert mock notifications.' });
  }
}

