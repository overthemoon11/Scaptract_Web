import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import SupportTicket from '../../models/supabase/SupportTicket.ts';

export default async function handler(req: Request, res: Response) {
  try {
    await requireAuth(req, 'admin');

    const { id } = req.params;
    const { status } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    if (!status || !['pending', 'solved', 'in_progress'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required (pending, solved, or in_progress)' });
    }

    // Check if ticket exists
    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Support ticket not found' });
    }

    // Update ticket status
    await SupportTicket.update(id, { status: status as 'pending' | 'solved' | 'in_progress' });

    return res.status(200).json({
      success: true,
      message: 'Ticket status updated successfully',
      ticket: {
        id: ticket.id?.toString() || '',
        status: status
      }
    });
  } catch (err: any) {
    console.error('Error updating ticket status:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update ticket status' });
  }
}
