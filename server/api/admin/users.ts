import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import User from '../../models/supabase/User.ts';

export default async function handler(req: Request, res: Response) {
  try {
    await requireAuth(req, 'admin');
    // connectDB is already called in requireAuth

    // Fetch all users (excluding admins, or include all - let's include all for now)
    const allUsers = await User.findAll();
    // Filter out admins if you only want regular users, or include all
    // For now, we'll return all users (admins can be filtered on frontend if needed)
    const users = allUsers.filter(u => u.role === 'user');

    return res.status(200).json({
      users: users.map(u => ({
        id: u.id?.toString() || '',
        _id: u.id?.toString() || '',
        name: u.name,
        email: u.email,
        status: u.status || 'active',
        createdAt: u.created_at || null
      }))
    });
  } catch (err: any) {
    console.error('Error fetching users:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch users' });
  }
}
