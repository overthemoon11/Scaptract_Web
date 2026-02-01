import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { parse, serialize } from 'cookie';
import { connectDB } from '../../lib/supabase.ts';
import User from '../../models/supabase/User.ts';
import { getSessionConfig } from '../../config/session.ts';
import { SignOptions } from 'jsonwebtoken';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).end();

  const cookies = parse(req.headers.cookie || '');
  const token = cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'No session found' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }

    // Verify the current token
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: number | string };

    await connectDB();
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const sessionConfig = getSessionConfig();

    // Generate a new token with extended expiration
    const signOptions: SignOptions = {
      expiresIn: sessionConfig.JWT_EXPIRES_IN as string | number
    } as SignOptions;

    const newToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      signOptions
    );

    // Set the new token as cookie
    const cookie = serialize('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: sessionConfig.COOKIE_MAX_AGE,
      path: '/'
    });

    res.setHeader('Set-Cookie', cookie);

    res.status(200).json({
      message: 'Session extended successfully',
      user: {
        _id: user.id?.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      },
      expiresIn: sessionConfig.TIMEOUT_DURATION
    });

  } catch (error: any) {
    console.error('Session extension error:', error);

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    res.status(500).json({ error: 'Failed to extend session' });
  }
}

