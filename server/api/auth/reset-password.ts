import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import User from '../../models/supabase/User.ts';
import { OTP } from '../../models/supabase/OTP.ts';
import bcrypt from 'bcrypt';

interface ResetPasswordBody {
  email: string;
  otp: string;
  newPassword: string;
}

export default async function handler(req: Request<{}, {}, ResetPasswordBody>, res: Response) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  await connectDB();

  // Find OTP record for password reset
  const otpRecord = await OTP.findByEmail(email);
  if (!otpRecord) {
    return res.status(400).json({ error: 'Reset code expired or invalid. Please request a new password reset.' });
  }

  // Check if in development mode
  const isDevMode = process.env.DEVMODE === 'true';

  // Verify OTP (bypass in dev mode if it's any 6-digit number)
  let otpValid = false;
  if (isDevMode) {
    // In dev mode, accept any 6-digit number
    otpValid = /^\d{6}$/.test(otp);
    if (otpValid) {
      console.log('🔧 DEVELOPMENT MODE: Password reset OTP verification bypassed');
      console.log(`✅ Accepted OTP: ${otp} (any 6-digit number works in dev mode)`);
      console.log(`🔑 New password: ${newPassword}`);
    }
  } else {
    // In production mode, check exact OTP match
    otpValid = otpRecord.otp_code === otp;
  }

  if (!otpValid) {
    return res.status(400).json({
      error: isDevMode ? 'Please enter a valid 6-digit number.' : 'Invalid reset code. Please try again.'
    });
  }

  try {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    const user = await User.findByEmail(email);
    if (user && user.id) {
      await User.update(user.id, { password: hashedPassword });
    }

    // Delete OTP record after successful password reset
    if (otpRecord.id) {
      await OTP.delete(otpRecord.id);
    }

    let message = 'Password reset successful! You can now login with your new password.';
    if (isDevMode) {
      message = 'DEVELOPMENT MODE: Password reset bypassed. You can now login with your new password.';
    }

    res.status(200).json({
      message: message,
      devMode: isDevMode
    });
  } catch (error: any) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
}

