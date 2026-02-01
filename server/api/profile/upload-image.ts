import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import User from '../../models/supabase/User.ts';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile images
  },
  fileFilter: (_req, file, cb: FileFilterCallback) => {
    // Only allow image files
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, GIF, WEBP) are supported'));
    }
  }
});

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    // Verify JWT token from cookies
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.token;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: number | string };
    const userId = decoded.userId;

    // Handle file upload
    upload.single('profileImage')(req, res, async (err) => {
      if (err) {
        console.error('Multer upload error:', err);
        if (err.message === 'Unexpected end of form') {
          return res.status(400).json({ 
            error: 'File upload was interrupted. Please try again.' 
          });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            error: 'File too large. Maximum file size is 5MB.' 
          });
        }
        return res.status(400).json({ error: err.message || 'File upload failed' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      try {
        const user = await User.findById(userId);
        if (!user) {
          // Delete uploaded file if user not found
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: 'User not found' });
        }

        // Delete old profile image if it exists
        if (user.profile_image) {
          // Handle both old format (full path) and new format (relative to uploads)
          let oldImagePath: string;
          if (user.profile_image.startsWith('uploads/')) {
            oldImagePath = path.join(process.cwd(), user.profile_image);
          } else {
            oldImagePath = path.join(process.cwd(), 'uploads', user.profile_image.replace(/^uploads\//, ''));
          }
          if (fs.existsSync(oldImagePath)) {
            try {
              fs.unlinkSync(oldImagePath);
            } catch (unlinkErr) {
              console.error('Error deleting old profile image:', unlinkErr);
            }
          }
        }

        // Update user with new profile image path
        // Store path relative to uploads directory for serving via /api/uploads/
        const relativePath = path.relative(path.join(process.cwd(), 'uploads'), req.file.path).replace(/\\/g, '/');
        await User.update(userId, { profile_image: `uploads/${relativePath}` });

        // Get updated user
        const updatedUser = await User.findById(userId);
        
        res.status(200).json({ 
          message: 'Profile image uploaded successfully',
          profile_image: updatedUser?.profile_image 
        });
      } catch (error: any) {
        // Delete uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        console.error('Error updating profile image:', error);
        res.status(500).json({ error: 'Failed to update profile image' });
      }
    });
  } catch (error: any) {
    console.error('Profile image upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

