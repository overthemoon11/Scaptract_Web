import { Request, Response } from 'express';
import { connectDB, getConnection } from '../../../lib/supabase.ts';
import ExtractionResult from '../../../models/supabase/ExtractionResult.ts';
import Document from '../../../models/supabase/Document.ts';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';

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

    // Get document to verify ownership
    const document = await Document.findById(id as string);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get extraction result
    const extractionResult = await ExtractionResult.getByDocumentId(id as string);

    // If this is an image, find all images with the same file_name
    let relatedImages: any[] = [];
    if (document.mime_type && document.mime_type.startsWith('image/')) {
      const supabase = getConnection();
      const { data: images, error: imagesError } = await supabase
        .from('documents')
        .select('id, original_name, file_name, file_path, mime_type, file_size, created_at')
        .eq('user_id', userId)
        .eq('file_name', document.file_name)
        .in('mime_type', ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff', 'image/gif', 'image/webp'])
        .order('created_at', { ascending: true });

      if (!imagesError && images) {
        relatedImages = images.map(img => ({
          id: img.id?.toString() || '',
          original_name: img.original_name,
          file_name: img.file_name,
          file_path: img.file_path,
          mime_type: img.mime_type,
          file_size: img.file_size,
          created_at: img.created_at
        }));
      }
    }

    return res.status(200).json({
      success: true,
      document: {
        id: document.id?.toString() || '',
        original_name: document.original_name,
        file_name: document.file_name,
        file_path: document.file_path,
        mime_type: document.mime_type,
        status: document.status || 'uploaded',
        page_count: document.page_count || 0,
        group_name: document.group_name || null,
        display_name: document.display_name || null,
        created_at: document.created_at || null,
        updated_at: document.updated_at || null
      },
      extractionResult: extractionResult ? {
        id: extractionResult.id?.toString() || '',
        extracted_text: extractionResult.extracted_text,
        structured_data: extractionResult.structured_data,
        accuracy: extractionResult.accuracy,
        processing_time_ms: extractionResult.processing_time_ms,
        status: extractionResult.status || 'completed',
        created_at: extractionResult.created_at || null
      } : null,
      relatedImages: relatedImages // Return all related images (even if just one)
    });

  } catch (error: any) {
    console.error('Error retrieving extraction result:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

