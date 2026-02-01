import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import { OTP } from '../../models/supabase/OTP.ts';
import { generateOTP, sendOTPEmail } from '../../lib/emailService.ts';

interface ResendOTPBody {
  email: string;
}

export default async function handler(req: Request<{}, {}, ResendOTPBody>, res: Response) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  await connectDB();

  // Find existing OTP record
  const otpRecord = await OTP.findByEmail(email);
  if (!otpRecord) {
    return res.status(400).json({ error: 'No pending verification found for this email.' });
  }

  // Generate new OTP
  const newOtp = generateOTP();

  // Update OTP record with new code and reset expiration
  if (otpRecord.id) {
    await OTP.update(otpRecord.id, {
      otp_code: newOtp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
    });
  }

  // Send new OTP email (or bypass in dev mode)
  const userInfo = typeof otpRecord.user_info === 'string' 
    ? JSON.parse(otpRecord.user_info || '{}') 
    : otpRecord.user_info || {};
  
  const emailResult = await sendOTPEmail(email, newOtp, userInfo.name || 'User');

  if (!emailResult.success) {
    return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }

  let message = 'New verification code sent to your email.';
  if (emailResult.devMode) {
    message = 'DEVELOPMENT MODE: New OTP generated. Any 6-digit number will work. Check console for details.';
  }

  res.status(200).json({
    message: message,
    devMode: emailResult.devMode
  });
}

