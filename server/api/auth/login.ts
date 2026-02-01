import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import User from '../../models/supabase/User.ts';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { serialize } from 'cookie';

interface LoginBody {
  email: string;
  password: string;
}

export default async function handler(req: Request<{}, {}, LoginBody>, res: Response) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Missing credentials.' });

  await connectDB();

  // Check if in development mode
  const isDevMode = process.env.DEVMODE === 'true';

  let user;
  let isValidCredentials = false;

  if (isDevMode) {
    // In development mode, accept any email/password combination
    console.log('🔧 DEVELOPMENT MODE: Login bypass enabled');
    console.log(`📧 Login attempt with email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log('ℹ️  Any email/password combination will work in dev mode');

    // Try to find existing user first
    user = await User.findByEmail(email);

    if (!user) {
      // Create a mock user for dev mode if none exists
      console.log('👤 Creating mock user for development mode');
      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = await User.create({
          name: email.split('@')[0] || 'Dev User',
          email: email,
          password: hashedPassword,
          role: 'user'
        });
        user = await User.findById(userId);
        console.log('✅ Mock user created successfully');
      } catch (error: any) {
        // If user creation fails (e.g., duplicate email), try to find existing user again
        user = await User.findByEmail(email);
        if (!user) {
          return res.status(500).json({ error: 'Failed to create or find user in dev mode.' });
        }
      }
    }

    isValidCredentials = true;
  } else {
    // Production mode - normal authentication
    user = await User.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      isValidCredentials = true;
    }
  }

  if (!user || !isValidCredentials) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'JWT_SECRET not configured' });
  }

  const signOptions: SignOptions = {
    expiresIn: '7d'
  };

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    signOptions
  );

  res.setHeader(
    'Set-Cookie',
    serialize('token', token, {
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      secure: process.env.NODE_ENV === 'production',
    })
  );

  let message = 'Login successful.';
  if (isDevMode) {
    message = 'DEVELOPMENT MODE: Login bypassed successfully.';
  }

  return res.status(200).json({
    message: message,
    user: { name: user.name, role: user.role },
    devMode: isDevMode
  });
}

