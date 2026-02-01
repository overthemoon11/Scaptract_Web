import { Request, Response } from 'express';
import { connectDB } from '../../../lib/supabase.ts';
import Document from '../../../models/supabase/Document.ts';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    await connectDB();

    // Extract document ID from parameter (format is "<id>.<extension>")
    // Example: "e023ff90-8980-4249-8af1-680730f23586.pdf" -> "e023ff90-8980-4249-8af1-680730f23586"
    const documentId = id.includes('.') ? id.substring(0, id.lastIndexOf('.')) : id;

    // Get document to verify ownership
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
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
    res.setHeader('Content-Disposition', `inline; filename="${document.original_name || 'document'}.pdf"`);
    
    // For PDFs and images, use inline to view in browser
    // For other files, use attachment to force download
    if (!['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'].includes(fileExtension)) {
      res.setHeader('Content-Disposition', `attachment; filename="${document.original_name || 'document'}.pdf"`);
    }

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
    console.error('Error downloading document:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

