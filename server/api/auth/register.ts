import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import User from '../../models/supabase/User.ts';
import { OTP } from '../../models/supabase/OTP.ts';
import bcrypt from 'bcrypt';
import { generateOTP, sendOTPEmail } from '../../lib/emailService.ts';

interface RegisterBody {
  name: string;
  email: string;
  password: string;
}

export default async function handler(req: Request<{}, {}, RegisterBody>, res: Response) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required.' });

  await connectDB();

  const exists = await User.findByEmail(email);
  if (exists) return res.status(409).json({ error: 'Email already in use.' });

  // Hash password for storage
  const hashed = await bcrypt.hash(password, 10);

  // Generate OTP
  const otp = generateOTP();

  // Store user data and OTP temporarily
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
  await OTP.create({
    email,
    otp_code: otp,
    expires_at: expiresAt,
    user_info: { name, email, password: hashed }
  });

  // Send OTP email (or bypass in dev mode)
  const emailResult = await sendOTPEmail(email, otp, name);

  if (!emailResult.success) {
    return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }

  let message = 'Verification code sent to your email. Please check your inbox.';
  if (emailResult.devMode) {
    message = 'DEVELOPMENT MODE: Any 6-digit number will work for verification. Check console for details.';
  }

  res.status(200).json({
    message: message,
    email: email,
    devMode: emailResult.devMode
  });
}

