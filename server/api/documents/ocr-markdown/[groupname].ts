import { Request, Response } from 'express';
import { connectDB, getConnection } from '../../../lib/supabase.ts';
import Document from '../../../models/supabase/Document.ts';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';

/**
 * Get OCR markdown files for a group
 * GET /api/documents/ocr-markdown/:groupname
 * Returns all markdown files from server/uploads/ocr-results/{groupname}/
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
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

    const { groupname } = req.params;

    console.log('[OCR Markdown API] Request received for groupname:', groupname);
    console.log('[OCR Markdown API] Full params:', req.params);

    if (!groupname) {
      console.error('[OCR Markdown API] No groupname provided');
      return res.status(400).json({ error: 'Group name is required' });
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

    // Construct path to OCR results directory
    // process.cwd() is already C:\GitHub\scaptract\server, so we just need uploads/ocr-results
    const ocrResultsDir = path.join(process.cwd(), 'uploads', 'ocr-results', groupname);
    console.log(`[OCR Markdown API] Looking for files in: ${ocrResultsDir}`);
    console.log(`[OCR Markdown API] Process cwd: ${process.cwd()}`);

    // Check if directory exists
    if (!fs.existsSync(ocrResultsDir)) {
      console.log(`[OCR Markdown API] Directory does not exist: ${ocrResultsDir}`);
      return res.status(200).json({
        success: true,
        markdownFiles: [],
        combinedMarkdown: ''
      });
    }

    console.log(`[OCR Markdown API] Directory exists, scanning for .md files...`);

    // Read all markdown files from the directory
    const markdownFiles: Array<{ name: string; content: string; path: string }> = [];

    // Function to recursively find all .md files
    function findMarkdownFiles(dir: string, relativePath: string = ''): void {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        console.log(`[OCR Markdown API] Scanning directory: ${dir} (${entries.length} entries)`);
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          // Normalize path separators to forward slashes for consistency (URLs use forward slashes)
          const relPath = relativePath 
            ? path.join(relativePath, entry.name).replace(/\\/g, '/')
            : entry.name;

          if (entry.isDirectory()) {
            console.log(`[OCR Markdown API] Entering subdirectory: ${entry.name}`);
            findMarkdownFiles(fullPath, relPath);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            console.log(`[OCR Markdown API] Found markdown file: ${relPath}`);
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              markdownFiles.push({
                name: entry.name,
                content: content,
                path: relPath // Already normalized to forward slashes
              });
              console.log(`[OCR Markdown API] Successfully read file: ${relPath} (${content.length} chars)`);
            } catch (error) {
              console.error(`[OCR Markdown API] Error reading markdown file ${fullPath}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`[OCR Markdown API] Error reading directory ${dir}:`, error);
      }
    }

    findMarkdownFiles(ocrResultsDir);

    console.log(`[OCR Markdown API] Found ${markdownFiles.length} markdown files`);

    // Sort files by path for consistent ordering
    // Handles both PDF uploads (files-xxx.pdf_N.md) and Image uploads (images-xxx-N_0/images-xxx-N_0.md)
    markdownFiles.sort((a, b) => {
      // Extract numeric page index from file path
      // Pattern 1 (PDF): filename_123.md -> extract 123
      // Pattern 2 (Image): images-xxx-123_0/... or images-xxx-123_0.md -> extract 123
      const getNumericSuffix = (filePath: string): number => {
        // Try PDF pattern first: _N.md at end of filename
        let match = filePath.match(/_(\d+)\.md$/);
        if (match) {
          return parseInt(match[1], 10);
        }
        
        // Try image pattern: -N_0 in directory or filename
        match = filePath.match(/-(\d+)_0/);
        if (match) {
          return parseInt(match[1], 10);
        }
        
        return 999; // No match found
      };
      
      const aNum = getNumericSuffix(a.path);
      const bNum = getNumericSuffix(b.path);
      
      if (aNum !== bNum) {
        return aNum - bNum;
      }
      
      return a.path.localeCompare(b.path);
    });

    // Convert relative image paths to relative URLs (not absolute)
    // Using relative URLs ensures cookies are sent with same-origin requests
    // Pattern: <img src="imgs/..." or <img src="./imgs/..." or markdown image syntax ![alt](imgs/...)
    // Replace with: /api/documents/ocr-images/{groupname}/{fullRelativePath}
    
    const processedFiles = markdownFiles.map(file => {
      let content = file.content;
      
      // Determine the base path for images based on file location
      // For PDFs: images are in groupname/imgs/
      // For images: images are in groupname/imagename_index/imgs/
      // Normalize path separators to forward slashes for consistency
      let fileDir = path.dirname(file.path).replace(/\\/g, '/');
      
      // Remove groupname from fileDir if it's present (to avoid duplication)
      // fileDir should be relative to the groupname directory, so it shouldn't contain groupname
      // But if it does (due to path construction issues), remove it
      if (fileDir.startsWith(groupname + '/')) {
        fileDir = fileDir.substring(groupname.length + 1);
      } else if (fileDir === groupname) {
        fileDir = '';
      }
      
      const isInSubdirectory = fileDir !== '.' && fileDir !== '';
      
      // Convert relative image paths to relative URLs
      content = content.replace(
        /(<img[^>]+src=["'])([^"']*imgs\/[^"']+)(["'])/gi,
        (match, prefix, imgPath, suffix) => {
          // Handle relative paths (./imgs/ or imgs/)
          let cleanPath = imgPath.replace(/^\.\//, '');
          
          // Remove groupname from cleanPath if it's present at the start
          if (cleanPath.startsWith(groupname + '/')) {
            cleanPath = cleanPath.substring(groupname.length + 1);
          }
          
          // If file is in a subdirectory, prepend the subdirectory path
          // For images: markdown is in groupname/imagename_index/imagename.md
          // Image is in groupname/imagename_index/imgs/image.jpg
          // So we need: imagename_index/imgs/image.jpg
          if (isInSubdirectory) {
            // Normalize path separators for cross-platform compatibility
            const normalizedFileDir = fileDir.replace(/\\/g, '/');
            const normalizedCleanPath = cleanPath.replace(/\\/g, '/');
            
            // Only prepend if the path doesn't already include the directory
            if (!normalizedCleanPath.startsWith(normalizedFileDir + '/') && !normalizedCleanPath.startsWith('/')) {
              cleanPath = `${normalizedFileDir}/${normalizedCleanPath}`;
            } else {
              cleanPath = normalizedCleanPath;
            }
          }
          
          // Remove any groupname that might be in the path before constructing URL
          let urlPath = cleanPath.replace(/\\/g, '/');
          if (urlPath.startsWith(groupname + '/')) {
            urlPath = urlPath.substring(groupname.length + 1);
          }
          
          // Encode each path segment separately to preserve forward slashes
          const pathSegments = urlPath.split('/').filter(seg => seg.length > 0);
          const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
          const encodedPath = encodedSegments.join('/');
          
          // Construct relative URL (use forward slashes for URLs)
          const relativePath = `/api/documents/ocr-images/${encodeURIComponent(groupname)}/${encodedPath}`;
          console.log(`[OCR Markdown API] Converting image path: "${imgPath}" -> "${urlPath}" -> "${encodedPath}" (fileDir: ${fileDir}, isInSubdirectory: ${isInSubdirectory})`);
          return `${prefix}${relativePath}${suffix}`;
        }
      );
      
      // Also handle markdown image syntax: ![alt](imgs/...)
      content = content.replace(
        /(!\[[^\]]*\]\()([^)]*imgs\/[^)]+)(\))/gi,
        (match, prefix, imgPath, suffix) => {
          let cleanPath = imgPath.replace(/^\.\//, '');
          
          // Remove groupname from cleanPath if it's present at the start
          if (cleanPath.startsWith(groupname + '/')) {
            cleanPath = cleanPath.substring(groupname.length + 1);
          }
          
          // If file is in a subdirectory, prepend the subdirectory path
          if (isInSubdirectory) {
            // Normalize path separators for cross-platform compatibility
            const normalizedFileDir = fileDir.replace(/\\/g, '/');
            const normalizedCleanPath = cleanPath.replace(/\\/g, '/');
            
            // Only prepend if the path doesn't already include the directory
            if (!normalizedCleanPath.startsWith(normalizedFileDir + '/') && !normalizedCleanPath.startsWith('/')) {
              cleanPath = `${normalizedFileDir}/${normalizedCleanPath}`;
            } else {
              cleanPath = normalizedCleanPath;
            }
          }
          
          // Remove any groupname that might be in the path before constructing URL
          let urlPath = cleanPath.replace(/\\/g, '/');
          if (urlPath.startsWith(groupname + '/')) {
            urlPath = urlPath.substring(groupname.length + 1);
          }
          
          // Encode each path segment separately to preserve forward slashes
          const pathSegments = urlPath.split('/').filter(seg => seg.length > 0);
          const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
          const encodedPath = encodedSegments.join('/');
          
          // Construct relative URL (use forward slashes for URLs)
          const relativePath = `/api/documents/ocr-images/${encodeURIComponent(groupname)}/${encodedPath}`;
          console.log(`[OCR Markdown API] Converting markdown image path: "${imgPath}" -> "${urlPath}" -> "${encodedPath}"`);
          return `${prefix}${relativePath}${suffix}`;
        }
      );
      
      return {
        ...file,
        content: content
      };
    });

    // Combine all markdown content with separators
    const combinedMarkdown = processedFiles
      .map((file, index) => {
        // Add a header for each file (except the first) to distinguish different files
        const separator = index > 0 ? `\n\n---\n\n` : '';
        return separator + file.content;
      })
      .join('');

    console.log(`[OCR Markdown API] Combined markdown length: ${combinedMarkdown.length} characters`);

    return res.status(200).json({
      success: true,
      markdownFiles: markdownFiles.map(file => ({
        name: file.name,
        path: file.path
      })),
      combinedMarkdown: combinedMarkdown
    });

  } catch (error: any) {
    console.error('Error fetching OCR markdown files:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
