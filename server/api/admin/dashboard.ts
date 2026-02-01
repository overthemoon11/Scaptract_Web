import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';

export default async function handler(req: Request, res: Response) {
  try {
    const user = await requireAuth(req, 'admin');
    res.status(200).json({ message: `Welcome admin ${user.name}` });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Auth error' });
  }
}

