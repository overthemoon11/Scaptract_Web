import { Request, Response } from 'express';
import { getConnection } from '../lib/supabase.ts';
import { connectDB } from '../lib/supabase.ts';

/**
 * Store an OCR page result
 * POST /api/ocr-pages
 * 
 * NOTE: This endpoint is DEPRECATED. Since all images are now processed in one OCR request,
 * Workflow 2 receives combined text directly and doesn't need to store individual pages.
 * This endpoint is kept for backward compatibility only.
 * 
 * Body:
 * {
 *   "batch_id": "batch_123",
 *   "extraction_result_id": "uuid",
 *   "page_number": 1,
 *   "text": "extracted text...",
 *   "total_pages": 5
 * }
 */
export async function storePage(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();
    const supabase = getConnection();

    const { batch_id, extraction_result_id, page_number, text, total_pages } = req.body;

    // Debug: Log what we received
    console.log(`[DEBUG] storePage received:`, {
      batch_id: batch_id,
      extraction_result_id: extraction_result_id,
      page_number: page_number,
      total_pages: total_pages,
      total_pages_type: typeof total_pages,
      has_text: !!text,
      full_body: JSON.stringify(req.body).substring(0, 500) // Log first 500 chars of body
    });

    // Validate required fields
    if (!batch_id || !extraction_result_id || page_number === undefined || !text) {
      return res.status(400).json({ 
        error: 'Missing required fields: batch_id, extraction_result_id, page_number, text' 
      });
    }

    // Insert or update page (handle duplicate page_number for same batch_id)
    // First try to insert, if it fails due to unique constraint, update instead
    let data, error;
    
    const insertData = {
      batch_id: batch_id.toString(),
      extraction_result_id: extraction_result_id.toString(),
      page_number: parseInt(page_number),
      text: text.toString()
    };

    // Try insert first
    const { data: insertData_result, error: insertError } = await supabase
      .from('ocr_pages')
      .insert(insertData)
      .select()
      .single();

    if (insertError && insertError.code === '23505') {
      // Unique constraint violation - update instead
      const { data: updateData_result, error: updateError } = await supabase
        .from('ocr_pages')
        .update({ text: text.toString() })
        .eq('batch_id', batch_id.toString())
        .eq('page_number', parseInt(page_number))
        .select()
        .single();
      
      data = updateData_result;
      error = updateError;
    } else {
      data = insertData_result;
      error = insertError;
    }

    if (error) {
      console.error('Error storing OCR page:', error);
      return res.status(500).json({ error: error.message || 'Failed to store page' });
    }

    // Check if all pages are received
    // Convert total_pages to number if it's a string
    const totalPagesNum = total_pages !== undefined && total_pages !== null 
      ? parseInt(total_pages.toString()) 
      : undefined;
    
    console.log(`[DEBUG] storePage: total_pages from body=${total_pages}, parsed=${totalPagesNum}`);
    
    const allPagesReceived = await checkAllPagesReceived(batch_id, totalPagesNum);

    return res.status(200).json({
      success: true,
      page_id: data.id,
      all_pages_received: allPagesReceived,
      message: 'Page stored successfully'
    });

  } catch (error: any) {
    console.error('Error in storePage:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Get all pages for a batch
 * GET /api/ocr-pages/:batch_id
 * 
 * NOTE: This endpoint is DEPRECATED. Since all images are now processed in one OCR request,
 * Workflow 2 receives combined text directly and doesn't need to retrieve individual pages.
 * This endpoint is kept for backward compatibility only.
 */
export async function getPages(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();
    const supabase = getConnection();

    const { batch_id } = req.params;

    if (!batch_id) {
      return res.status(400).json({ error: 'batch_id is required' });
    }

    // Get all pages for this batch, sorted by page_number
    const { data, error } = await supabase
      .from('ocr_pages')
      .select('*')
      .eq('batch_id', batch_id.toString())
      .order('page_number', { ascending: true });

    if (error) {
      console.error('Error fetching OCR pages:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch pages' });
    }

    // Combine all text in order
    const combinedText = data.map(page => page.text).join('\n\n');

    return res.status(200).json({
      batch_id,
      pages: data,
      page_count: data.length,
      combined_text: combinedText
    });

  } catch (error: any) {
    console.error('Error in getPages:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Check if all pages are received for a batch
 * GET /api/ocr-pages/:batch_id/status
 * 
 * NOTE: This endpoint is DEPRECATED. Since all images are now processed in one OCR request,
 * Workflow 2 receives combined text directly and doesn't need to check page status.
 * This endpoint is kept for backward compatibility only.
 */
export async function getBatchStatus(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();
    const supabase = getConnection();

    const { batch_id } = req.params;
    const { total_pages } = req.query;

    if (!batch_id) {
      return res.status(400).json({ error: 'batch_id is required' });
    }

    // Count pages for this batch
    const { count, error: countError } = await supabase
      .from('ocr_pages')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batch_id.toString());

    if (countError) {
      console.error('Error counting OCR pages:', countError);
      return res.status(500).json({ error: countError.message || 'Failed to count pages' });
    }

    const receivedPages = count || 0;
    const expectedPages = total_pages ? parseInt(total_pages.toString()) : null;
    const allPagesReceived = expectedPages ? receivedPages >= expectedPages : false;

    return res.status(200).json({
      batch_id,
      received_pages: receivedPages,
      expected_pages: expectedPages,
      all_pages_received: allPagesReceived
    });

  } catch (error: any) {
    console.error('Error in getBatchStatus:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Helper function to check if all pages are received
 */
async function checkAllPagesReceived(batchId: string, totalPages?: number): Promise<boolean> {
  if (!totalPages || totalPages <= 0) {
    console.log(`[DEBUG] checkAllPagesReceived: totalPages is ${totalPages}, returning false`);
    return false;
  }

  try {
    const supabase = getConnection();
    const { count, error } = await supabase
      .from('ocr_pages')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId.toString());

    if (error) {
      console.error('Error counting pages:', error);
      return false;
    }

    const receivedCount = count || 0;
    const allReceived = receivedCount >= totalPages;
    
    console.log(`[DEBUG] checkAllPagesReceived: batch_id=${batchId}, received=${receivedCount}, total=${totalPages}, all_received=${allReceived}`);
    
    return allReceived;
  } catch (error) {
    console.error('Error checking all pages received:', error);
    return false;
  }
}
