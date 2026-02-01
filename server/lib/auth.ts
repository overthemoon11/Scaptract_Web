import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { connectDB } from './supabase.ts';
import User from '../models/supabase/User.ts';
import { User as UserType } from '@shared/types/index.ts';

export async function requireAuth(req: Request, role?: 'admin' | 'user'): Promise<UserType> {
  const token = req.cookies?.token || req.headers.cookie?.split('token=')[1]?.split(';')[0];

  if (!token) {
    throw { status: 401, message: 'Unauthorized: No token' };
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number | string };
  await connectDB();
  const user = await User.findById(decoded.userId);

  if (!user) {
    throw { status: 401, message: 'Unauthorized: Invalid user' };
  }

  if (role && user.role !== role) {
    throw { status: 403, message: 'Forbidden: Insufficient role' };
  }

  return {
    _id: user.id.toString(),
    id: user.id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as 'user' | 'admin',
    status: user.status,
    profile_image: user.profile_image,
  };
}

