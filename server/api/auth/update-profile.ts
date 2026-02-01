import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import User from '../../models/supabase/User.ts';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

interface UpdateProfileBody {
  name: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
}

export default async function handler(req: Request<{}, {}, UpdateProfileBody>, res: Response) {
  if (req.method !== 'PUT') return res.status(405).end();

  const { name, email, currentPassword, newPassword } = req.body;

  // Get user from token
  const cookies = parse(req.headers.cookie || '');
  const token = cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: number | string };
    await connectDB();

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Check if email is already taken by another user
    if (email !== user.email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.id !== user.id) {
        return res.status(400).json({ error: 'Email is already taken by another user' });
      }
    }

    // If password change is requested, validate current password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

      // Check if in development mode (bypass password verification)
      const isDevMode = process.env.DEVMODE === 'true';

      if (!isDevMode) {
        // In production, verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({ error: 'Current password is incorrect' });
        }
      } else {
        console.log('🔧 DEVELOPMENT MODE: Password verification bypassed for profile update');
        console.log(`👤 User: ${user.email}`);
        console.log(`🔑 New password: ${newPassword}`);
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update user with new password
      if (user.id) {
        await User.update(user.id, { name, email, password: hashedPassword });
      }
    } else {
      // Update user without password change
      if (user.id) {
        await User.update(user.id, { name, email });
      }
    }

    // Get updated user data
    const updatedUser = user.id ? await User.findById(user.id) : null;

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found after update' });
    }

    // Return updated user data (without password)
    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        _id: updatedUser.id?.toString(),
        id: updatedUser.id?.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        profile_image: updatedUser.profile_image,
        created_at: updatedUser.created_at
      },
      devMode: process.env.DEVMODE === 'true'
    });

  } catch (error: any) {
    console.error('Profile update error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    res.status(500).json({ error: 'Failed to update profile' });
  }
}

