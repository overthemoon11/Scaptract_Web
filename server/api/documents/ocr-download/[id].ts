import { Request, Response } from 'express';
import { connectDB } from '../../../lib/supabase.ts';
import Document from '../../../models/supabase/Document.ts';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

/**
 * Public endpoint for OCR file access
 * Uses a secure token in the URL instead of cookies
 * Format: /api/documents/ocr-download/{documentId}?token={jwt_token}
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.params;
    let token = req.query.token;

    console.log('🔍 OCR Download Request:', {
      id,
      hasToken: !!token,
      tokenType: typeof token,
      queryParams: Object.keys(req.query),
      url: req.url
    });

    if (!id) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    // Handle token - it might be a string or array
    if (Array.isArray(token)) {
      token = token[0];
    }

    if (!token || typeof token !== 'string') {
      console.error('❌ Missing or invalid token:', { token, type: typeof token });
      return res.status(401).json({ error: 'Access token is required' });
    }

    // Decode URL-encoded token if needed
    try {
      token = decodeURIComponent(token);
    } catch (e) {
      // Token might not be encoded, that's okay
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }

    // Verify the token
    let decoded: { documentId: string | number; purpose: string; exp?: number };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET) as { documentId: string | number; purpose: string; exp?: number };
      console.log('✅ Token verified:', { documentId: decoded.documentId, purpose: decoded.purpose });
    } catch (error: any) {
      console.error('❌ Token verification failed:', error.message);
      return res.status(401).json({ error: `Invalid or expired token: ${error.message}` });
    }

    // Verify token is for OCR purpose
    if (decoded.purpose !== 'ocr-access') {
      return res.status(403).json({ error: 'Invalid token purpose' });
    }

    // Verify token matches document ID
    const documentId = id.includes('.') ? id.substring(0, id.lastIndexOf('.')) : id;
    if (String(decoded.documentId) !== String(documentId)) {
      return res.status(403).json({ error: 'Token does not match document' });
    }

    await connectDB();

    // Get document
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if file exists
    const filePath = document.file_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const fileExtension = path.extname(filePath).toLowerCase();
    
    // Determine content type based on mime_type or file extension
    let contentType = document.mime_type || 'application/octet-stream';
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', `inline; filename="${document.original_name || 'document'}"`);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow Dify to access the file
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });

  } catch (error: any) {
    console.error('Error downloading document for OCR:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

