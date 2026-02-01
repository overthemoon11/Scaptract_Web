import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import SupportTicket from '../../models/supabase/SupportTicket.ts';

export default async function handler(req: Request, res: Response) {
  try {
    await requireAuth(req, 'admin');

    // Fetch all support tickets with user info
    const allTickets = await SupportTicket.findAll();

    return res.status(200).json({
      tickets: allTickets.map(t => ({
        id: t.id?.toString() || '',
        _id: t.id?.toString() || '',
        title: t.title,
        description: t.description || t.message || '',
        status: t.status || 'pending',
        user_id: t.user_id?.toString() || '',
        user_name: t.user_name || 'Unknown',
        createdAt: t.created_at || null,
        created_at: t.created_at || null,
        updatedAt: t.updated_at || null,
        updated_at: t.updated_at || null
      }))
    });
  } catch (err: any) {
    console.error('Error fetching support tickets:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch support tickets' });
  }
}
