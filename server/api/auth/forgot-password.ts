import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import User from '../../models/supabase/User.ts';
import { OTP } from '../../models/supabase/OTP.ts';
import { generateOTP, sendOTPEmail } from '../../lib/emailService.ts';

interface ForgotPasswordBody {
  email: string;
}

export default async function handler(req: Request<{}, {}, ForgotPasswordBody>, res: Response) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  await connectDB();

  // Check if user exists
  const user = await User.findByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'No account found with this email address.' });
  }

  // Generate OTP for password reset
  const otp = generateOTP();

  // Store OTP for password reset (different from registration OTP)
  await OTP.create({
    email,
    otp_code: otp,
    expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    user_info: {
      name: user.name,
      email: user.email,
      type: 'password_reset'
    }
  });

  // Send OTP email (or bypass in dev mode)
  const emailResult = await sendOTPEmail(email, otp, user.name, 'password_reset');

  if (!emailResult.success) {
    return res.status(500).json({ error: 'Failed to send reset code. Please try again.' });
  }

  let message = 'Password reset code sent to your email. Please check your inbox.';

  res.status(200).json({
    message: message,
    email: email,
    devMode: emailResult.devMode
  });
}

