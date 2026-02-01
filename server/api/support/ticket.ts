import { Request, Response } from 'express';
import { User } from '@shared/types/index.ts';
import SupportTicket from '../../models/supabase/SupportTicket.ts';

interface AuthenticatedRequest extends Request {
  user?: User;
}

interface CreateTicketBody {
  title: string;
  description: string;
}

export default async function handler(req: AuthenticatedRequest, res: Response) {
  if (req.method === 'POST') {
    const { title, description } = req.body as CreateTicketBody;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required.' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const userId = req.user.id?.toString() || req.user._id?.toString() || '';
      const ticketId = await SupportTicket.create({
        title: title.trim(),
        description: description.trim(),
        user_id: userId,
      });
      const ticket = await SupportTicket.findById(ticketId);
      return res.status(201).json({
        success: true,
        ticket: ticket
      });
    } catch (err: any) {
      console.error('Error creating support ticket:', err);
      return res.status(500).json({ error: err.message || 'Failed to create ticket.' });
    }
  } else if (req.method === 'GET') {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const userId = req.user.id?.toString() || req.user._id?.toString() || '';
      const tickets = await SupportTicket.findByUserId(userId);
      return res.status(200).json({
        success: true,
        tickets: tickets
      });
    } catch (err: any) {
      console.error('Error fetching support tickets:', err);
      return res.status(500).json({ error: err.message || 'Failed to fetch tickets.' });
    }
  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

