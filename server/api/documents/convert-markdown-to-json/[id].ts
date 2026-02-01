import { Request, Response } from 'express';
import { connectDB, getConnection } from '../../../lib/supabase.ts';
import Document from '../../../models/supabase/Document.ts';
import ExtractionResult from '../../../models/supabase/ExtractionResult.ts';
import { convertOcrMarkdownToJson } from '../../../lib/markdownToJson.ts';
import path from 'path';
import fs from 'fs';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';

/**
 * Convert markdown to JSON and store in structured_data
 * POST /api/documents/convert-markdown-to-json/:id
 * Where :id is the extraction_result_id
 */
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

    const { id } = req.params; // extraction_result_id or 'group'
    const { group_name } = req.query; // Optional group_name for group views

    // Handle group views
    if (id === 'group' && group_name) {
      const groupName = decodeURIComponent(group_name as string);
      
      // Verify user has access to this group
      const supabase = getConnection();
      const { data: documents } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', userId.toString())
        .eq('group_name', groupName)
        .limit(1);

      if (!documents || documents.length === 0) {
        return res.status(403).json({ error: 'Access denied or group not found' });
      }

      // Get group-level extraction result (use maybeSingle to handle no results)
      const { data: groupResult, error: groupResultError } = await supabase
        .from('extraction_results')
        .select('*')
        .eq('group_name', groupName)
        .is('document_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Check if structured_data exists and has actual content (not just metadata)
      if (groupResult?.structured_data) {
        const hasContent = typeof groupResult.structured_data === 'object' && 
          Object.keys(groupResult.structured_data).length > 0 &&
          // Check if content object has actual sections (not just metadata)
          (groupResult.structured_data.content || 
           Object.keys(groupResult.structured_data).some(key => 
             key !== 'metadata' && key !== 'structured_elements' && key !== 'sectionOrder'
           ));
        
        if (hasContent) {
          console.log(`ℹ️ Structured data already exists for group ${groupName}`);
          return res.status(200).json({
            success: true,
            message: 'Structured data already exists',
            structured_data: groupResult.structured_data
          });
        }
      }

      // Convert markdown for group
      const defaultOcrPath = path.join(process.cwd(), 'uploads', 'ocr-results', groupName);
      if (!fs.existsSync(defaultOcrPath)) {
        return res.status(404).json({ 
          error: 'No markdown files found',
          message: 'Could not find markdown files to convert.'
        });
      }

      console.log(`🔄 Converting markdown to JSON for group ${groupName}...`);
      const structuredData = await convertOcrMarkdownToJson(defaultOcrPath);

      // Update or create group-level extraction result
      if (groupResult) {
        await ExtractionResult.update(groupResult.id, {
          structured_data: structuredData,
          ocr_result_path: `uploads/ocr-results/${groupName}`
        });
      } else {
        // Create new group-level result
        await ExtractionResult.create({
          document_id: null,
          group_name: groupName,
          structured_data: structuredData,
          status: 'completed',
          extraction_method: 'ocr',
          ocr_result_path: `uploads/ocr-results/${groupName}`
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Markdown converted to JSON and stored successfully',
        structured_data: structuredData
      });
    }

    // Handle individual document views
    if (!id) {
      return res.status(400).json({ error: 'Extraction result ID or group_name is required' });
    }

    console.log(`🔄 Converting markdown to JSON for extraction result ${id}...`);

    // Get extraction result
    const extractionResult = await ExtractionResult.findById(id);
    if (!extractionResult) {
      return res.status(404).json({ error: 'Extraction result not found' });
    }

    // Verify user has access (check via document)
    if (extractionResult.document_id) {
      const document = await Document.findById(extractionResult.document_id);
      if (!document || document.user_id !== userId.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Check if structured_data already exists and has content
    if (extractionResult.structured_data && 
        typeof extractionResult.structured_data === 'object' && 
        Object.keys(extractionResult.structured_data).length > 0) {
      console.log(`ℹ️ Structured data already exists for extraction result ${id}`);
      return res.status(200).json({
        success: true,
        message: 'Structured data already exists',
        structured_data: extractionResult.structured_data
      });
    }

    // Try to find markdown files and convert
    let structuredData: any = null;
    let foundPath: string | null = null;

    // 1. Try ocr_result_path from extraction result
    if (extractionResult.ocr_result_path) {
      const fullOcrPath = path.isAbsolute(extractionResult.ocr_result_path)
        ? extractionResult.ocr_result_path
        : path.join(process.cwd(), extractionResult.ocr_result_path);
      
      if (fs.existsSync(fullOcrPath)) {
        console.log(`📁 Converting markdown from stored OCR path: ${fullOcrPath}`);
        try {
          structuredData = await convertOcrMarkdownToJson(fullOcrPath);
          foundPath = fullOcrPath;
        } catch (error: any) {
          console.error(`❌ Error converting from stored path: ${error.message}`);
        }
      }
    }

    // 2. Try to find from document's group_name
    if (!structuredData && extractionResult.document_id) {
      const document = await Document.findById(extractionResult.document_id);
      if (document?.group_name) {
        const defaultOcrPath = path.join(
          process.cwd(),
          'uploads',
          'ocr-results',
          document.group_name
        );
        
        if (fs.existsSync(defaultOcrPath)) {
          console.log(`📁 Converting markdown from default OCR path: ${defaultOcrPath}`);
          try {
            structuredData = await convertOcrMarkdownToJson(defaultOcrPath);
            foundPath = defaultOcrPath;
          } catch (error: any) {
            console.error(`❌ Error converting from default path: ${error.message}`);
          }
        }
      }
    }

    // 3. Try group_name from extraction result (for group-level results)
    if (!structuredData && extractionResult.group_name) {
      const defaultOcrPath = path.join(
        process.cwd(),
        'uploads',
        'ocr-results',
        extractionResult.group_name
      );
      
      if (fs.existsSync(defaultOcrPath)) {
        console.log(`📁 Converting markdown from group_name OCR path: ${defaultOcrPath}`);
        try {
          structuredData = await convertOcrMarkdownToJson(defaultOcrPath);
          foundPath = defaultOcrPath;
        } catch (error: any) {
          console.error(`❌ Error converting from group_name path: ${error.message}`);
        }
      }
    }

    if (!structuredData) {
      return res.status(404).json({ 
        error: 'No markdown files found',
        message: 'Could not find markdown files to convert. Please ensure OCR processing has completed.'
      });
    }

    // Store structured_data in database
    await ExtractionResult.update(id, {
      structured_data: structuredData
    });

    // Also update ocr_result_path if we found it and it wasn't stored
    if (foundPath && !extractionResult.ocr_result_path) {
      const relativePath = path.relative(process.cwd(), foundPath).replace(/\\/g, '/');
      await ExtractionResult.update(id, {
        ocr_result_path: relativePath
      });
      console.log(`📁 Saved OCR result path: ${relativePath}`);
    }

    console.log(`✅ Successfully converted and stored structured data for extraction result ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Markdown converted to JSON and stored successfully',
      structured_data: structuredData
    });

  } catch (error: any) {
    console.error('Error converting markdown to JSON:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
