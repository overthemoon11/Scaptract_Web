import express, { Request, Response } from 'express';
import { connectDB } from '../lib/supabase.ts';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { serialize } from 'cookie';
import { generateOTP, sendOTPEmail } from '../lib/emailService.ts';
import { requireAuth } from '../lib/auth.ts';
import User from '../models/supabase/User.ts';
import { OTP } from '../models/supabase/OTP.ts';

const router = express.Router();

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody {
  name: string;
  email: string;
  password: string;
}

interface VerifyOTPBody {
  email: string;
  otp: string;
}

interface ForgotPasswordBody {
  email: string;
}

interface ResetPasswordBody {
  email: string;
  otp: string;
  newPassword: string;
}

interface UpdateProfileBody {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

// Login
router.get('/login', (_req: Request, res: Response) => {
  return res.status(405).json({ 
    error: 'Method not allowed. Use POST request with JSON body containing email and password.' 
  });
});

router.post('/login', async (req: Request<{}, {}, LoginBody>, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Missing credentials.' });

    await connectDB();

    const isDevMode = process.env.DEVMODE === 'true';

    let user: any;
    let isValidCredentials = false;

    if (isDevMode) {
      console.log('🔧 DEVELOPMENT MODE: Login bypass enabled');
      console.log(`📧 Login attempt with email: ${email}`);
      console.log(`🔑 Password: ${password}`);
      console.log('ℹ️  Any email/password combination will work in dev mode');

      user = await User.findByEmail(email);

      if (!user) {
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
        } catch (error) {
          user = await User.findByEmail(email);
          if (!user) {
            return res.status(500).json({ error: 'Failed to create or find user in dev mode.' });
          }
        }
      }

      isValidCredentials = true;
    } else {
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

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.setHeader(
      'Set-Cookie',
      serialize('token', token, {
        httpOnly: true,
        path: '/',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7,
        secure: process.env.NODE_ENV === 'production',
      })
    );

    let message = 'Login successful.';
    if (isDevMode) {
      message = 'DEVELOPMENT MODE: Login bypassed successfully.';
    }

    return res.status(200).json({
      message: message,
      user: { 
        _id: user.id.toString(),
        id: user.id.toString(),
        name: user.name, 
        email: user.email,
        role: user.role 
      },
      devMode: isDevMode
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      error: error.message || 'An error occurred during login.' 
    });
  }
});

// Register
router.post('/register', async (req: Request<{}, {}, RegisterBody>, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required.' });

  await connectDB();

  const exists = await User.findByEmail(email);
  if (exists) return res.status(409).json({ error: 'Email already in use.' });

  const hashed = await bcrypt.hash(password, 10);
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OTP.create({
    email,
    otp_code: otp,
    expires_at: expiresAt,
    user_info: { name, email, password: hashed }
  });

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
});

// Verify OTP
router.post('/verify-otp', async (req: Request<{}, {}, VerifyOTPBody>, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }

  await connectDB();

  const otpRecord = await OTP.findByEmail(email);
  if (!otpRecord) {
    return res.status(400).json({ error: 'OTP expired or invalid. Please register again.' });
  }

  const isDevMode = process.env.DEVMODE === 'true';

  let otpValid = false;
  if (isDevMode) {
    otpValid = /^\d{6}$/.test(otp);
    if (otpValid) {
      console.log('🔧 DEVELOPMENT MODE: OTP verification bypassed');
      console.log(`✅ Accepted OTP: ${otp} (any 6-digit number works in dev mode)`);
    }
  } else {
    otpValid = otpRecord.otp_code === otp;
  }

  if (!otpValid) {
    return res.status(400).json({
      error: isDevMode ? 'Please enter a valid 6-digit number.' : 'Invalid OTP. Please try again.'
    });
  }

  try {
    const userInfo = typeof otpRecord.user_info === 'string' 
      ? JSON.parse(otpRecord.user_info) 
      : otpRecord.user_info;
    const userId = await User.create({
      name: userInfo.name,
      email: userInfo.email,
      password: userInfo.password
    });

    await OTP.markAsUsed(otpRecord.id as number);

    let message = 'Email verified successfully! Registration completed.';
    if (isDevMode) {
      message = 'DEVELOPMENT MODE: Email verification bypassed. Registration completed.';
    }

    const user = await User.findById(userId);
    if (!user || !user.id) {
      return res.status(500).json({ error: 'Failed to create user' });
    }
    res.status(201).json({
      message: message,
      user: { 
        _id: user.id.toString(),
        id: user.id.toString(),
        name: user.name, 
        email: user.email 
      },
      devMode: isDevMode
    });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ error: 'Failed to complete registration. Please try again.' });
  }
});

// Logout
router.post('/logout', (_req: Request, res: Response) => {
  res.setHeader(
    'Set-Cookie',
    serialize('token', '', {
      httpOnly: true,
      path: '/',
      expires: new Date(0),
    })
  );
  res.status(200).json({ message: 'Logged out' });
});

// Forgot Password
router.post('/forgot-password', async (req: Request<{}, {}, ForgotPasswordBody>, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  await connectDB();

  const user = await User.findByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'No account found with this email address.' });
  }

  const otp = generateOTP();

  await OTP.create({
    email,
    otp_code: otp,
    expires_at: new Date(Date.now() + 10 * 60 * 1000),
    user_info: {
      name: user.name,
      email: user.email,
      type: 'password_reset'
    }
  });

  const emailResult = await sendOTPEmail(email, otp, user.name, 'password_reset');

  if (!emailResult.success) {
    return res.status(500).json({ error: 'Failed to send reset code. Please try again.' });
  }

  res.status(200).json({
    message: 'Password reset code sent to your email. Please check your inbox.',
    email: email,
    devMode: emailResult.devMode
  });
});

// Reset Password
router.post('/reset-password', async (req: Request<{}, {}, ResetPasswordBody>, res: Response) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  await connectDB();

  const otpRecord = await OTP.findByEmail(email);
  if (!otpRecord) {
    return res.status(400).json({ error: 'Reset code expired or invalid. Please request a new password reset.' });
  }

  const isDevMode = process.env.DEVMODE === 'true';

  let otpValid = false;
  if (isDevMode) {
    otpValid = /^\d{6}$/.test(otp);
    if (otpValid) {
      console.log('🔧 DEVELOPMENT MODE: Password reset OTP verification bypassed');
      console.log(`✅ Accepted OTP: ${otp} (any 6-digit number works in dev mode)`);
      console.log(`🔑 New password: ${newPassword}`);
    }
  } else {
    otpValid = otpRecord.otp_code === otp;
  }

  if (!otpValid) {
    return res.status(400).json({
      error: isDevMode ? 'Please enter a valid 6-digit number.' : 'Invalid reset code. Please try again.'
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
        const user = await User.findByEmail(email);
        if (user && user.id) {
          await User.update(user.id, { password: hashedPassword });
        }

    await OTP.delete(otpRecord.id as number);

    let message = 'Password reset successful! You can now login with your new password.';
    if (isDevMode) {
      message = 'DEVELOPMENT MODE: Password reset bypassed. You can now login with your new password.';
    }

    res.status(200).json({
      message: message,
      devMode: isDevMode
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// Resend OTP
router.post('/resend-otp', async (req: Request<{}, {}, ForgotPasswordBody>, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  await connectDB();

  const otpRecord = await OTP.findByEmail(email);
  if (!otpRecord) {
    return res.status(400).json({ error: 'No pending verification found for this email.' });
  }

  const newOtp = generateOTP();

  await OTP.update(otpRecord.id as number, {
    otp_code: newOtp,
    expires_at: new Date(Date.now() + 10 * 60 * 1000)
  });

  const userInfo = typeof otpRecord.user_info === 'string' 
    ? JSON.parse(otpRecord.user_info) 
    : otpRecord.user_info || {};
  const emailResult = await sendOTPEmail(email, newOtp, userInfo.name);

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
});

// Update Profile
router.put('/update-profile', async (req: Request<{}, {}, UpdateProfileBody>, res: Response) => {
  try {
    const user = await requireAuth(req);
    const { name, email, currentPassword, newPassword } = req.body;

    await connectDB();

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    if (email !== user.email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.id !== user.id) {
        return res.status(400).json({ error: 'Email is already taken by another user' });
      }
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

      const isDevMode = process.env.DEVMODE === 'true';

      if (!isDevMode && user.id) {
        const userRecord = await User.findById(user.id);
        if (userRecord) {
          const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userRecord.password);
          if (!isCurrentPasswordValid) {
            return res.status(400).json({ error: 'Current password is incorrect' });
          }
        }
      } else {
        console.log('🔧 DEVELOPMENT MODE: Password verification bypassed for profile update');
        console.log(`👤 User: ${user.email}`);
        console.log(`🔑 New password: ${newPassword}`);
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      if (user.id) {
        await User.update(parseInt(user.id as string), { name, email, password: hashedPassword });
      }
    } else {
      if (user.id) {
        await User.update(parseInt(user.id as string), { name, email });
      }
    }

    const updatedUser = user.id ? await User.findById(user.id) : null;
    if (!updatedUser || !updatedUser.id) {
      return res.status(404).json({ error: 'User not found after update' });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        _id: updatedUser.id.toString(),
        id: updatedUser.id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      },
      devMode: process.env.DEVMODE === 'true'
    });

  } catch (error: any) {
    console.error('Profile update error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    res.status(error.status || 500).json({ error: error.message || 'Failed to update profile' });
  }
});

// Extend Session
router.post('/extend-session', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req);
    const { getSessionConfig } = await import('../config/session.ts');
    const sessionConfig = getSessionConfig();

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    if (!user.id) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const signOptions = {
      expiresIn: sessionConfig.JWT_EXPIRES_IN
    } as SignOptions;
    const newToken = jwt.sign(
      { userId: user.id },
      jwtSecret,
      signOptions
    );

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
        _id: user.id.toString(),
        id: user.id.toString(),
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
    res.status(error.status || 500).json({ error: error.message || 'Failed to extend session' });
  }
});

// Dev Check
router.get('/dev-check', (_req: Request, res: Response) => {
  res.json({ devMode: process.env.DEVMODE === 'true' });
});

export default router;

