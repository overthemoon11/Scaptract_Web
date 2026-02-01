import { Request, Response } from 'express';
import { connectDB, getConnection } from '../../../../lib/supabase.ts';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';

/**
 * Serve OCR images from server/uploads/ocr-results/{groupname}/
 * GET /api/documents/ocr-images/:groupname/*
 * Example: /api/documents/ocr-images/group-123/imgs/image.jpg
 *          /api/documents/ocr-images/group-123/imagename_0/imgs/image.jpg
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log(`[OCR Images API] ===== IMAGE REQUEST RECEIVED =====`);
  console.log(`[OCR Images API] Method: ${req.method}`);
  console.log(`[OCR Images API] URL: ${req.url}`);
  console.log(`[OCR Images API] Original URL: ${req.originalUrl}`);
  console.log(`[OCR Images API] Path: ${req.path}`);
  console.log(`[OCR Images API] Base URL: ${req.baseUrl}`);
  console.log(`[OCR Images API] Params:`, req.params);

  try {
    await connectDB();

    // Verify JWT token from cookies
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.token;
    
    console.log(`[OCR Images API] Cookie header: ${req.headers.cookie ? 'present' : 'missing'}`);
    console.log(`[OCR Images API] Parsed cookies:`, Object.keys(cookies));
    console.log(`[OCR Images API] Token found: ${token ? 'yes' : 'no'}`);

    if (!token) {
      console.error(`[OCR Images API] No token provided - returning 401`);
      return res.status(401).json({ error: 'No token provided' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: number | string };
    const userId = decoded.userId;

    // Extract groupname and image path from the request
    // The route regex matches: /ocr-images/([^/]+)/(.+)$
    // Express stores regex capture groups in req.params as an array
    // For regex routes, capture groups are in req.params[0], req.params[1], etc.
    const params = req.params as any;
    
    // Try to get from regex capture groups first (for regex routes)
    // Then fallback to named params or URL parsing
    let groupname = params[0] || params.groupname || '';
    let imagePath = params[1] || params.path || '';
    
    // If still not found, try parsing from req.url
    if (!groupname || !imagePath) {
      const fullPath = req.url.split('?')[0]; // Remove query string
      const urlMatch = fullPath.match(/\/ocr-images\/([^/]+)\/(.+)$/);
      if (urlMatch) {
        groupname = urlMatch[1];
        imagePath = urlMatch[2];
      }
    }
    
    console.log(`[OCR Images API] Request URL: ${req.url}`);
    console.log(`[OCR Images API] req.params:`, req.params);
    console.log(`[OCR Images API] Extracted groupname: ${groupname}, imagePath: ${imagePath}`);

    if (!groupname || !imagePath) {
      return res.status(400).json({ error: 'Group name and image path are required' });
    }

    // Verify user has access to documents in this group
    const supabase = getConnection();
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id')
      .eq('user_id', userId.toString())
      .eq('group_name', groupname)
      .limit(1);

    if (docsError || !documents || documents.length === 0) {
      return res.status(403).json({ error: 'Access denied or group not found' });
    }

    // Construct full path to image file
    // imagePath is already a string from Express wildcard (URL-encoded, use forward slashes)
    // Decode URL encoding and normalize path separators
    const decodedImagePath = decodeURIComponent(imagePath);
    const normalizedImagePath = decodedImagePath.replace(/\//g, path.sep); // Convert URL slashes to OS path separators
    
    // process.cwd() is already C:\GitHub\scaptract\server, so we just need uploads/ocr-results
    const ocrResultsDir = path.join(process.cwd(), 'uploads', 'ocr-results', groupname);
    const imageFilePath = path.join(ocrResultsDir, normalizedImagePath);
    
    console.log(`[OCR Images API] Serving image - groupname: ${groupname}, decoded path: ${decodedImagePath}, full path: ${imageFilePath}`);

    // Security: Ensure the resolved path is within ocrResultsDir (prevent directory traversal)
    const resolvedPath = path.resolve(imageFilePath);
    const resolvedDir = path.resolve(ocrResultsDir);
    
    if (!resolvedPath.startsWith(resolvedDir)) {
      return res.status(403).json({ error: 'Invalid image path' });
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      console.error(`[OCR Images API] Image not found at: ${resolvedPath}`);
      console.error(`[OCR Images API] Expected in directory: ${resolvedDir}`);
      console.error(`[OCR Images API] Looking for: ${normalizedImagePath}`);
      return res.status(404).json({ error: 'Image not found', debug: { resolvedPath, resolvedDir, normalizedImagePath } });
    }

    // Check if it's actually a file (not a directory)
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }

    // Determine content type based on file extension
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set headers and send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    const fileStream = fs.createReadStream(resolvedPath);
    fileStream.pipe(res);

  } catch (error: any) {
    console.error('Error serving OCR image:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
