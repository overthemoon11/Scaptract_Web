import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';

export default async function handler(_req: Request, res: Response) {
  try {
    await connectDB();
    res.status(200).json({ message: 'Supabase connected successfully!' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Supabase connection failed.' });
  }
}

