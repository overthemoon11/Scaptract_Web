import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import User from '../../models/supabase/User.ts';
import { OTP } from '../../models/supabase/OTP.ts';

interface VerifyOTPBody {
  email: string;
  otp: string;
}

export default async function handler(req: Request<{}, {}, VerifyOTPBody>, res: Response) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }

  await connectDB();

  // Find OTP record
  const otpRecord = await OTP.findByEmail(email);
  if (!otpRecord) {
    return res.status(400).json({ error: 'OTP expired or invalid. Please register again.' });
  }

  // Check if in development mode
  const isDevMode = process.env.DEVMODE === 'true';

  // Verify OTP (bypass in dev mode if it's any 6-digit number)
  let otpValid = false;
  if (isDevMode) {
    // In dev mode, accept any 6-digit number
    otpValid = /^\d{6}$/.test(otp);
    if (otpValid) {
      console.log('🔧 DEVELOPMENT MODE: OTP verification bypassed');
      console.log(`✅ Accepted OTP: ${otp} (any 6-digit number works in dev mode)`);
    }
  } else {
    // In production mode, check exact OTP match
    otpValid = otpRecord.otp_code === otp;
  }

  if (!otpValid) {
    return res.status(400).json({
      error: isDevMode ? 'Please enter a valid 6-digit number.' : 'Invalid OTP. Please try again.'
    });
  }

  try {
    // Create user with stored information
    const userInfo = typeof otpRecord.user_info === 'string' 
      ? JSON.parse(otpRecord.user_info) 
      : otpRecord.user_info;
    
    const userId = await User.create({
      name: userInfo.name,
      email: userInfo.email,
      password: userInfo.password
    });

    // Mark OTP as used after successful verification
    if (otpRecord.id) {
      await OTP.markAsUsed(otpRecord.id);
    }

    let message = 'Email verified successfully! Registration completed.';
    if (isDevMode) {
      message = 'DEVELOPMENT MODE: Email verification bypassed. Registration completed.';
    }

    const user = await User.findById(userId);
    res.status(201).json({
      message: message,
      user: user ? { name: user.name, email: user.email } : null,
      devMode: isDevMode
    });
  } catch (error: any) {
    console.error('User creation error:', error);
    res.status(500).json({ error: 'Failed to complete registration. Please try again.' });
  }
}

