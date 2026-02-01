import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import User from '../../models/supabase/User.ts';

export default async function handler(req: Request, res: Response) {
  try {
    await requireAuth(req, 'admin');
    // connectDB is already called in requireAuth

    // Fetch all users and filter for admins only
    const allUsers = await User.findAll();
    const admins = allUsers.filter(u => u.role === 'admin');

    return res.status(200).json({
      admins: admins.map(a => ({
        id: a.id?.toString() || '',
        _id: a.id?.toString() || '',
        name: a.name,
        email: a.email,
        status: a.status || 'active',
        createdAt: a.created_at || null
      }))
    });
  } catch (err: any) {
    console.error('Error fetching admins:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch admins' });
  }
}
