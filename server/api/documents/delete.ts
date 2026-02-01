import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import Document from '../../models/supabase/Document.ts';
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';
import fs from 'fs';
import path from 'path';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'DELETE') {
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

    // Get file_id or document id from query parameter
    const fileId = req.query.file_id as string;
    const documentId = req.query.id as string;

    if (!fileId && !documentId) {
      return res.status(400).json({ error: 'Either file_id or id parameter is required' });
    }

    let deletedCount: number;
    let filePaths: string[];

    if (fileId) {
      // Delete all documents with this file_id and get file paths
      // Note: Database CASCADE will automatically delete related data:
      // - extraction_results (via document_id foreign key with ON DELETE CASCADE)
      // - comments (via document_id foreign key with ON DELETE CASCADE)
      // - ocr_pages (via extraction_result_id foreign key with ON DELETE CASCADE, when extraction_results are deleted)
      const result = await Document.deleteByFileId(fileId, userId);
      deletedCount = result.deletedCount;
      filePaths = result.filePaths;
    } else {
      // Delete single document by id (for backward compatibility)
      const document = await Document.findById(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Verify ownership
      if (document.user_id !== userId.toString()) {
        return res.status(403).json({ error: 'Unauthorized access' });
      }

      filePaths = [document.file_path];
      await Document.delete(documentId);
      deletedCount = 1;
    }

    if (deletedCount === 0) {
      return res.status(404).json({ error: 'No documents found with the specified file_id' });
    }

    // Delete physical files from disk
    const deletedFiles: string[] = [];
    const failedFiles: string[] = [];

    for (const filePath of filePaths) {
      try {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          deletedFiles.push(filePath);
        }
      } catch (error: any) {
        console.error(`Failed to delete file ${filePath}:`, error);
        failedFiles.push(filePath);
      }
    }

    // Also check for related directories (e.g., temp_pdf_pages directories)
    const groupFoldersToCheck = new Set<string>();
    for (const filePath of filePaths) {
      try {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
        const dir = path.dirname(fullPath);
        const fileName = path.basename(fullPath, path.extname(fullPath));
        const tempDir = path.join(dir, `temp_pdf_pages_${fileName}`);
        
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
          console.log(`Deleted temp directory: ${tempDir}`);
        }

        // Track group folders for cleanup
        const groupFolder = path.dirname(fullPath);
        if (path.basename(groupFolder).startsWith('group-')) {
          groupFoldersToCheck.add(groupFolder);
        }
      } catch (error: any) {
        console.error(`Failed to delete temp directory for ${filePath}:`, error);
      }
    }

    // Clean up empty group folders
    for (const groupFolder of groupFoldersToCheck) {
      try {
        if (fs.existsSync(groupFolder)) {
          const files = fs.readdirSync(groupFolder);
          if (files.length === 0) {
            fs.rmdirSync(groupFolder);
            console.log(`Deleted empty group folder: ${groupFolder}`);
          }
        }
      } catch (error: any) {
        console.error(`Failed to delete group folder ${groupFolder}:`, error);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} document(s)`,
      deletedCount,
      deletedFiles: deletedFiles.length,
      failedFiles: failedFiles.length
    });

  } catch (error: any) {
    console.error('Delete error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
