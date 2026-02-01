import { Request, Response } from 'express';
import { connectDB, getConnection } from '../../../lib/supabase.ts';
import Document from '../../../models/supabase/Document.ts';
import ExtractionResult from '../../../models/supabase/ExtractionResult.ts';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';

/**
 * Get all documents in a group and aggregate their extraction results
 * GET /api/documents/group/:group_name
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

    const { group_name } = req.params;

    if (!group_name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const supabase = getConnection();

    // Get all documents in this group for this user
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId.toString())
      .eq('group_name', group_name)
      .order('created_at', { ascending: true });

    if (docsError) {
      console.error('Error fetching documents:', docsError);
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    if (!documents || documents.length === 0) {
      return res.status(404).json({ error: 'No documents found for this group' });
    }

    // First, try to get group-level extraction_result (if it exists)
    const { data: groupResult, error: groupResultError } = await supabase
      .from('extraction_results')
      .select('*')
      .eq('group_name', group_name)
      .is('document_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let combinedExtractedText = '';
    let combinedStructuredData: any = {};
    let avgAccuracy = 0;
    let totalProcessingTime = 0;
    let overallStatus = 'processing';
    let extraction_result_count = 0;

    if (groupResult && !groupResultError) {
      // Use pre-combined group result
      console.log(`   [GROUP] Using pre-combined group extraction_result`);
      combinedExtractedText = groupResult.extracted_text || '';
      combinedStructuredData = groupResult.structured_data || {};
      avgAccuracy = groupResult.accuracy || 0;
      totalProcessingTime = groupResult.processing_time_ms || 0;
      overallStatus = groupResult.status || 'completed';
      
      // Get count of individual document results for count
      const documentIds = documents.map((doc: any) => doc.id);
      const { data: individualResults } = await supabase
        .from('extraction_results')
        .select('id')
        .in('document_id', documentIds);
      extraction_result_count = individualResults?.length || 0;
    } else {
      // Fallback: Combine on-demand from individual document results
      console.log(`   [GROUP] No group-level result found, combining individual results on-demand`);
      const documentIds = documents.map((doc: any) => doc.id);
      const { data: extractionResults, error: resultsError } = await supabase
        .from('extraction_results')
        .select('*')
        .in('document_id', documentIds)
        .order('created_at', { ascending: true });

      if (resultsError) {
        console.error('Error fetching extraction results:', resultsError);
        return res.status(500).json({ error: 'Failed to fetch extraction results' });
      }

      extraction_result_count = extractionResults?.length || 0;

      // Combine extracted_text from all results (remove page break markers, join with newlines)
      combinedExtractedText = extractionResults
        ?.map((result: any) => result.extracted_text)
        .filter((text: string) => text && text.trim())
        .map((text: string) => {
          // Remove "--- Page Break ---" markers
          return text.replace(/---\s*Page\s*Break\s*---/gi, '').trim();
        })
        .join('\n\n') || '';

      // Combine structured_data - merge all JSON objects
      const allStructuredData: any[] = [];

      extractionResults?.forEach((result: any) => {
        if (result.structured_data) {
          try {
            let parsed: any;
            if (typeof result.structured_data === 'string') {
              parsed = JSON.parse(result.structured_data);
            } else {
              parsed = result.structured_data;
            }
            allStructuredData.push(parsed);
          } catch (e) {
            console.error('Error parsing structured_data:', e);
          }
        }
      });

      // Merge structured data intelligently
      if (allStructuredData.length > 0) {
        // If all have the same title key structure, merge sections
        const firstData = allStructuredData[0];
        const titleKey = Object.keys(firstData).find(key => 
          !['section_order', 'sectionOrder', 'summaries', 'Content'].includes(key) &&
          typeof firstData[key] === 'object' &&
          !Array.isArray(firstData[key])
        );

        if (titleKey) {
          // Merge all sections from all documents
          combinedStructuredData[titleKey] = {};
          allStructuredData.forEach((data: any) => {
            if (data[titleKey] && typeof data[titleKey] === 'object') {
              Object.assign(combinedStructuredData[titleKey], data[titleKey]);
            }
          });

          // Merge section orders (if present)
          const sectionOrders = allStructuredData
            .map((data: any) => data.section_order || data.sectionOrder)
            .filter((order: any) => Array.isArray(order));
          if (sectionOrders.length > 0) {
            // Use the first section order as base, add unique sections from others
            const baseOrder = sectionOrders[0] || [];
            const allSections = new Set(baseOrder);
            sectionOrders.forEach((order: any) => {
              order.forEach((section: string) => allSections.add(section));
            });
            combinedStructuredData.sectionOrder = Array.from(allSections);
          }

          // Merge summaries (if present)
          const allSummaries: Record<string, string> = {};
          allStructuredData.forEach((data: any) => {
            if (data.summaries && typeof data.summaries === 'object') {
              Object.assign(allSummaries, data.summaries);
            }
          });
          if (Object.keys(allSummaries).length > 0) {
            combinedStructuredData.summaries = allSummaries;
          }
        } else {
          // Fallback: just use the first one or combine as array
          combinedStructuredData = firstData;
        }
      }

      // Calculate aggregate accuracy (average)
      const accuracies = extractionResults
        ?.map((r: any) => r.accuracy || 0)
        .filter((acc: number) => acc > 0) || [];
      avgAccuracy = accuracies.length > 0
        ? accuracies.reduce((sum: number, acc: number) => sum + acc, 0) / accuracies.length
        : 0;

      // Calculate total processing time
      totalProcessingTime = extractionResults
        ?.reduce((sum: number, r: any) => sum + (r.processing_time_ms || 0), 0) || 0;

      // Determine overall status
      const statuses = extractionResults?.map((r: any) => r.status) || [];
      overallStatus = 'completed';
      if (statuses.some((s: string) => s === 'processing')) {
        overallStatus = 'processing';
      } else if (statuses.some((s: string) => s === 'failed')) {
        overallStatus = statuses.every((s: string) => s === 'failed') ? 'failed' : 'completed';
      }
    }

    return res.status(200).json({
      success: true,
      group_name: group_name,
      documents: documents.map(doc => ({
        id: doc.id?.toString() || '',
        original_name: doc.original_name,
        file_name: doc.file_name,
        file_path: doc.file_path,
        mime_type: doc.mime_type,
        status: doc.status || 'uploaded',
        page_count: doc.page_count || 0,
        group_name: doc.group_name || null,
        display_name: doc.display_name || null,
        created_at: doc.created_at || null,
        updated_at: doc.updated_at || null
      })),
      combinedExtractionResult: {
        extracted_text: combinedExtractedText,
        structured_data: combinedStructuredData,
        accuracy: Math.round(avgAccuracy * 100) / 100,
        processing_time_ms: totalProcessingTime,
        status: overallStatus,
        document_count: documents.length,
        extraction_result_count: extraction_result_count
      }
    });

  } catch (error: any) {
    console.error('Error retrieving group extraction results:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
