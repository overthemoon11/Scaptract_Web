import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import User from '../../models/supabase/User.ts';

export default async function handler(req: Request, res: Response) {
  try {
    await requireAuth(req, 'admin');
    // connectDB is already called in requireAuth

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user status to active
    await User.update(id, { status: 'active' });

    return res.status(200).json({ 
      message: 'User activated successfully',
      user: {
        id: user.id?.toString() || '',
        status: 'active'
      }
    });
  } catch (err: any) {
    console.error('Error activating user:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to activate user' });
  }
}
