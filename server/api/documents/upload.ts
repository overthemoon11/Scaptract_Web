import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import Document from '../../models/supabase/Document.ts';
import FileType from '../../models/supabase/FileType.ts';
import Analytic from '../../models/supabase/Analytic.ts';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument } from 'pdf-lib';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
    files: 50, // Maximum 50 files at once
  },
  fileFilter: (_req, file, cb: FileFilterCallback) => {
    // Only allow PDF and image files
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/bmp',
      'image/tiff',
      'image/gif',
      'image/webp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files (JPG, PNG, BMP, TIFF, GIF, WEBP) are supported'));
    }
  }
});

// Helper function to get PDF page count
async function getPDFPageCount(filePath: string): Promise<number> {
  try {
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error('Error reading PDF page count:', error);
    return 0; // Return 0 if we can't read the PDF
  }
}

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
    upload.array('files')(req, res, async (err) => {
      if (err) {
        console.error('Multer upload error:', err);
        // Handle specific multer errors
        if (err.message === 'Unexpected end of form') {
          return res.status(400).json({ 
            error: 'File upload was interrupted. Please try again with a smaller file or check your network connection.' 
          });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            error: 'File too large. Maximum file size is 50MB.' 
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ 
            error: 'Too many files. Maximum 100 files can be uploaded at once.' 
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ 
            error: 'Unexpected file field. Please use the field name "files".' 
          });
        }
        return res.status(400).json({ error: err.message || 'File upload failed' });
      }

      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const files = Array.isArray(req.files) ? req.files : [];
      const uploadedDocuments: any[] = [];

      // Generate a single file_id and group_name for all documents in this upload batch
      const fileId = uuidv4();
      const groupName = `group-${Date.now()}-${Math.round(Math.random() * 1E9)}`;

      // Create group folder for this batch
      const groupFolder = path.join(process.cwd(), 'uploads', 'documents', groupName);
      if (!fs.existsSync(groupFolder)) {
        fs.mkdirSync(groupFolder, { recursive: true });
      }

      // Separate images from PDFs
      const imageFiles = files.filter(file => file.mimetype.startsWith('image/'));
      const pdfFiles = files.filter(file => file.mimetype === 'application/pdf');

      // Process multiple images - each gets unique file_name to avoid OCR result overwrites
      if (imageFiles.length > 1) {
        // Generate a base file_name for all images in this batch
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const baseFileName = `images-${uniqueSuffix}`;
        const originalNames = imageFiles.map(f => f.originalname).join(', ');

        console.log(`Saving ${imageFiles.length} images with unique file_name (base: ${baseFileName})`);

        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          try {
            const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
            
            // Find or create file type
            let fileType = await FileType.findByExtension(fileExtension);
            if (!fileType) {
              const fileTypeId = await FileType.create({
                name: fileExtension.toUpperCase(),
                extension: fileExtension,
                mime_type: file.mimetype,
                is_supported: true,
                max_size_mb: 50
              });
              fileType = await FileType.findById(fileTypeId);
            }

            if (!fileType || !fileType.id) {
              throw new Error('Failed to get or create file type');
            }

            // Generate unique file_name per document to avoid OCR result overwrites
            // Use index to make filename unique: {baseFileName}-{index}
            const uniqueFileName = `${baseFileName}-${i}`;
            const indexedFileName = `${uniqueFileName}${path.extname(file.originalname)}`;
            
            // Move file to group folder with indexed name
            const newFilePath = path.join(groupFolder, indexedFileName);
            fs.renameSync(file.path, newFilePath);

            // Create document record - use unique file_name per document
            const documentData = {
              user_id: String(userId),
              file_type_id: fileType.id,
              file_id: fileId, // Same file_id for all documents in this batch
              group_name: groupName, // Same group_name for all documents in this batch
              file_name: uniqueFileName, // Unique file_name per document to avoid OCR overwrites
              original_name: file.originalname,
              file_path: newFilePath,
              file_size: file.size,
              mime_type: file.mimetype,
              page_count: 1,
              status: 'uploaded'
            };

            const documentId = await Document.create(documentData);
            const document = await Document.findById(documentId);

            if (!document) {
              throw new Error('Failed to create document');
            }

            uploadedDocuments.push({
              id: documentId,
              original_name: file.originalname,
              file_name: uniqueFileName, // Unique per document
              file_size: file.size,
              status: 'uploaded',
              created_at: document.created_at
            });

            // Record analytics
            await Analytic.create({
              file_type_id: fileType.id,
              metric_type: 'upload_count',
              value: 1,
              date_recorded: new Date().toISOString().split('T')[0]
            });

          } catch (fileError: any) {
            console.error('Error processing image file:', fileError);
            console.error('File that failed:', file.originalname, fileError.message);
          }
        }

        if (uploadedDocuments.length === 0 && imageFiles.length > 1) {
          console.error(`❌ Failed to process any of ${imageFiles.length} images`);
        } else {
          console.log(`✅ Successfully saved ${uploadedDocuments.length} of ${imageFiles.length} images with unique file_name (base: ${baseFileName})`);
        }
      } else if (imageFiles.length === 1) {
        // Single image - process normally
        const file = imageFiles[0];
        try {
          const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
          let fileType = await FileType.findByExtension(fileExtension);
          if (!fileType) {
            const fileTypeId = await FileType.create({
              name: fileExtension.toUpperCase(),
              extension: fileExtension,
              mime_type: file.mimetype,
              is_supported: true,
              max_size_mb: 50
            });
            fileType = await FileType.findById(fileTypeId);
          }

          if (!fileType || !fileType.id) {
            throw new Error('Failed to get or create file type');
          }

          // Images are always 1 page
          const pageCount = 1;

          // Move file to group folder
          const fileName = path.basename(file.filename);
          const newFilePath = path.join(groupFolder, fileName);
          fs.renameSync(file.path, newFilePath);

          const documentData = {
            user_id: String(userId),
            file_type_id: fileType.id,
            file_id: fileId, // Same file_id for all documents in this batch
            group_name: groupName, // Same group_name for all documents in this batch
            file_name: file.filename,
            original_name: file.originalname,
            file_path: newFilePath,
            file_size: file.size,
            mime_type: file.mimetype,
            page_count: pageCount,
            status: 'uploaded'
          };

          const documentId = await Document.create(documentData);
          const document = await Document.findById(documentId);

          if (!document) {
            throw new Error('Failed to create document');
          }

          uploadedDocuments.push({
            id: documentId,
            original_name: file.originalname,
            file_name: file.filename,
            file_size: file.size,
            status: 'uploaded',
            created_at: document.created_at
          });

          await Analytic.create({
            file_type_id: fileType.id,
            metric_type: 'upload_count',
            value: 1,
            date_recorded: new Date().toISOString().split('T')[0]
          });
        } catch (fileError: any) {
          console.error('Error processing single image file:', fileError);
          console.error('File that failed:', file.originalname, fileError.message);
        }
      }

      // Process PDF files normally
      for (const file of pdfFiles) {
        try {
          const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
          let fileType = await FileType.findByExtension(fileExtension);
          if (!fileType) {
            const fileTypeId = await FileType.create({
              name: fileExtension.toUpperCase(),
              extension: fileExtension,
              mime_type: file.mimetype,
              is_supported: true,
              max_size_mb: 50
            });
            fileType = await FileType.findById(fileTypeId);
          }

          if (!fileType || !fileType.id) {
            throw new Error('Failed to get or create file type');
          }

          // Get PDF page count
          const pageCount = await getPDFPageCount(file.path);

          // Move file to group folder
          const fileName = path.basename(file.filename);
          const newFilePath = path.join(groupFolder, fileName);
          fs.renameSync(file.path, newFilePath);

          const documentData = {
            user_id: String(userId),
            file_type_id: fileType.id,
            file_id: fileId, // Same file_id for all documents in this batch
            group_name: groupName, // Same group_name for all documents in this batch
            file_name: file.filename,
            original_name: file.originalname,
            file_path: newFilePath,
            file_size: file.size,
            mime_type: file.mimetype,
            page_count: pageCount,
            status: 'uploaded'
          };

          const documentId = await Document.create(documentData);
          const document = await Document.findById(documentId);

          if (!document) {
            throw new Error('Failed to create document');
          }

          uploadedDocuments.push({
            id: documentId,
            original_name: file.originalname,
            file_name: file.filename,
            file_size: file.size,
            status: 'uploaded',
            created_at: document.created_at
          });

          await Analytic.create({
            file_type_id: fileType.id,
            metric_type: 'upload_count',
            value: 1,
            date_recorded: new Date().toISOString().split('T')[0]
          });
        } catch (fileError: any) {
          console.error('Error processing PDF file:', fileError);
          console.error('File that failed:', file.originalname, fileError.message);
        }
      }

      // Check if any documents were successfully uploaded
      if (uploadedDocuments.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No documents were successfully uploaded. Please check the files and try again.'
        });
      }

      res.status(200).json({
        success: true,
        message: `${uploadedDocuments.length} files uploaded successfully`,
        documents: uploadedDocuments
      });

    });

  } catch (error: any) {
    console.error('Upload error:', error);
    console.error('Error stack:', error.stack);
    
    // Don't send response if headers already sent
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

