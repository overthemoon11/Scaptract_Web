import { Request, Response } from 'express';
import { getConnection } from '../../lib/supabase.ts';
import { requireAuth } from '../../lib/auth.ts';

interface AnalyticsData {
  dailyUploads: Array<{ date: string; count: number }>;
  averageProcessingTime: Array<{ date: string; avgTime: number }>;
  errorRate: Array<{ date: string; errorRate: number }>;
  ocrAccuracy: Array<{ date: string; avgAccuracy: number }>;
  ocrAccuracyByType: Array<{ type: string; avgAccuracy: number; count: number }>;
  fileTypeDistribution: Array<{ type: string; count: number }>;
  successRate: Array<{ date: string; successRate: number }>;
  dailyFileTypeDistribution?: Array<{ type: string; count: number }>;
  totalStats: {
    totalDocuments: number;
    totalProcessed: number;
    totalFailed: number;
    averageProcessingTime: number;
    averageAccuracy: number;
  };
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify user is admin
    await requireAuth(req, 'admin');

    const supabase = getConnection();
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get daily uploads
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('created_at, status')
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: true });

    if (docsError) throw docsError;

    // Get extraction results for processing time and accuracy
    // Calculate processing time from created_at and updated_at timestamps
    const { data: extractions, error: extractionsError } = await supabase
      .from('extraction_results')
      .select('created_at, updated_at, processing_time_ms, accuracy, status, document_id')
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: true });

    if (extractionsError) throw extractionsError;

    // Get document mime_types for accuracy by type calculation
    const extractionDocumentIds = extractions?.map((e: any) => e.document_id).filter(Boolean) || [];
    let documentMimeTypes: Map<string, string> = new Map();
    if (extractionDocumentIds.length > 0) {
      const { data: docs, error: docsMimeError } = await supabase
        .from('documents')
        .select('id, mime_type')
        .in('id', extractionDocumentIds);
      
      if (!docsMimeError && docs) {
        docs.forEach((doc: any) => {
          documentMimeTypes.set(doc.id, doc.mime_type);
        });
      }
    }

    // Process daily uploads
    const dailyUploadsMap = new Map<string, number>();
    documents?.forEach((doc: any) => {
      const date = new Date(doc.created_at).toISOString().split('T')[0];
      dailyUploadsMap.set(date, (dailyUploadsMap.get(date) || 0) + 1);
    });

    const dailyUploads = Array.from(dailyUploadsMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Process average processing time - use processing_time_ms from database
    const processingTimeMap = new Map<string, { total: number; count: number }>();
    extractions?.forEach((ext: any) => {
      // Use processing_time_ms from database (preferred)
      // Fallback to timestamp calculation only if processing_time_ms is not available
      let calculatedProcessingTime: number | null = null;
      
      if (ext.processing_time_ms && ext.processing_time_ms > 0) {
        // Use stored processing_time_ms from database
        calculatedProcessingTime = ext.processing_time_ms;
      } else if (ext.created_at && ext.updated_at) {
        // Fallback: calculate from timestamps if processing_time_ms not available
        const created = new Date(ext.created_at).getTime();
        const updated = new Date(ext.updated_at).getTime();
        calculatedProcessingTime = updated - created;
      }
      
      if (calculatedProcessingTime !== null && calculatedProcessingTime >= 0) {
        const date = new Date(ext.created_at).toISOString().split('T')[0];
        const existing = processingTimeMap.get(date) || { total: 0, count: 0 };
        processingTimeMap.set(date, {
          total: existing.total + calculatedProcessingTime,
          count: existing.count + 1
        });
      }
    });

    const averageProcessingTime = Array.from(processingTimeMap.entries())
      .map(([date, data]) => ({ 
        date, 
        avgTime: Math.round(data.total / data.count) 
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Process error rate
    const errorMap = new Map<string, { errors: number; total: number }>();
    documents?.forEach((doc: any) => {
      const date = new Date(doc.created_at).toISOString().split('T')[0];
      const existing = errorMap.get(date) || { errors: 0, total: 0 };
      errorMap.set(date, {
        errors: existing.errors + (doc.status === 'failed' ? 1 : 0),
        total: existing.total + 1
      });
    });

    const errorRate = Array.from(errorMap.entries())
      .map(([date, data]) => ({ 
        date, 
        errorRate: data.total > 0 ? Math.round((data.errors / data.total) * 100) : 0 
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Process OCR accuracy
    const accuracyMap = new Map<string, { total: number; count: number }>();
    extractions?.forEach((ext: any) => {
      if (ext.accuracy && ext.status === 'completed') {
        const date = new Date(ext.created_at).toISOString().split('T')[0];
        const existing = accuracyMap.get(date) || { total: 0, count: 0 };
        accuracyMap.set(date, {
          total: existing.total + ext.accuracy,
          count: existing.count + 1
        });
      }
    });

    const ocrAccuracy = Array.from(accuracyMap.entries())
      .map(([date, data]) => ({ 
        date, 
        avgAccuracy: Math.round((data.total / data.count) * 100) / 100 
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Process OCR accuracy by document type
    const accuracyByTypeMap = new Map<string, { total: number; count: number }>();
    extractions?.forEach((ext: any) => {
      if (ext.accuracy && ext.status === 'completed' && ext.document_id) {
        const mimeType = documentMimeTypes.get(ext.document_id);
        if (mimeType) {
          const type = mimeType.split('/')[1]?.toUpperCase() || 'UNKNOWN';
          // Filter out OCTET-STREAM (fallback mime type) and UNKNOWN
          if (type !== 'OCTET-STREAM' && type !== 'UNKNOWN') {
            const existing = accuracyByTypeMap.get(type) || { total: 0, count: 0 };
            accuracyByTypeMap.set(type, {
              total: existing.total + ext.accuracy,
              count: existing.count + 1
            });
          }
        }
      }
    });

    const ocrAccuracyByType = Array.from(accuracyByTypeMap.entries())
      .map(([type, data]) => ({
        type,
        avgAccuracy: Math.round((data.total / data.count) * 100) / 100,
        count: data.count
      }))
      .sort((a, b) => b.avgAccuracy - a.avgAccuracy);

    // Get file type distribution
    const { data: fileTypes, error: fileTypesError } = await supabase
      .from('documents')
      .select('mime_type')
      .gte('created_at', startDateStr);

    if (fileTypesError) throw fileTypesError;

    const fileTypeMap = new Map<string, number>();
    fileTypes?.forEach((doc: any) => {
      const type = doc.mime_type?.split('/')[1]?.toUpperCase() || 'UNKNOWN';
      fileTypeMap.set(type, (fileTypeMap.get(type) || 0) + 1);
    });

    const fileTypeDistribution = Array.from(fileTypeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Get daily file type distribution for specific date (if provided)
    let dailyFileTypeDistribution: Array<{ type: string; count: number }> | undefined;
    const selectedDate = req.query.date as string;
    if (selectedDate) {
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];

      const { data: dailyDocs, error: dailyDocsError } = await supabase
        .from('documents')
        .select('mime_type')
        .gte('created_at', selectedDate)
        .lt('created_at', nextDayStr);

      if (!dailyDocsError && dailyDocs) {
        const dailyFileTypeMap = new Map<string, number>();
        dailyDocs.forEach((doc: any) => {
          const type = doc.mime_type?.split('/')[1]?.toUpperCase() || 'UNKNOWN';
          // Filter out OCTET-STREAM (fallback mime type) and UNKNOWN
          if (type !== 'OCTET-STREAM' && type !== 'UNKNOWN') {
            dailyFileTypeMap.set(type, (dailyFileTypeMap.get(type) || 0) + 1);
          }
        });

        dailyFileTypeDistribution = Array.from(dailyFileTypeMap.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count);
      }
    }

    // Process success rate
    const successMap = new Map<string, { success: number; total: number }>();
    documents?.forEach((doc: any) => {
      const date = new Date(doc.created_at).toISOString().split('T')[0];
      const existing = successMap.get(date) || { success: 0, total: 0 };
      successMap.set(date, {
        success: existing.success + (doc.status === 'completed' ? 1 : 0),
        total: existing.total + 1
      });
    });

    const successRate = Array.from(successMap.entries())
      .map(([date, data]) => ({ 
        date, 
        successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0 
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate total stats
    const totalDocuments = documents?.length || 0;
    const totalProcessed = documents?.filter((d: any) => d.status === 'completed').length || 0;
    const totalFailed = documents?.filter((d: any) => d.status === 'failed').length || 0;
    
    // Calculate average processing time - use processing_time_ms from database
    const completedExtractions = extractions?.filter((e: any) => e.status === 'completed') || [];
    const processingTimes: number[] = [];
    
    completedExtractions.forEach((ext: any) => {
      let calculatedTime: number | null = null;
      
      // Use processing_time_ms from database (preferred)
      // Fallback to timestamp calculation only if processing_time_ms is not available
      if (ext.processing_time_ms && ext.processing_time_ms > 0) {
        calculatedTime = ext.processing_time_ms;
      } else if (ext.created_at && ext.updated_at) {
        // Fallback: calculate from timestamps if processing_time_ms not available
        const created = new Date(ext.created_at).getTime();
        const updated = new Date(ext.updated_at).getTime();
        calculatedTime = updated - created;
      }
      
      if (calculatedTime !== null && calculatedTime >= 0) {
        processingTimes.push(calculatedTime);
      }
    });
    
    const avgProcessingTime = processingTimes.length > 0
      ? Math.round(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length)
      : 0;

    const completedWithAccuracy = extractions?.filter((e: any) => e.status === 'completed' && e.accuracy) || [];
    const avgAccuracy = completedWithAccuracy.length > 0
      ? Math.round((completedWithAccuracy.reduce((sum: number, e: any) => sum + e.accuracy, 0) / completedWithAccuracy.length) * 100) / 100
      : 0;

    const analyticsData: AnalyticsData = {
      dailyUploads,
      averageProcessingTime,
      errorRate,
      ocrAccuracy,
      ocrAccuracyByType,
      fileTypeDistribution,
      successRate,
      dailyFileTypeDistribution,
      totalStats: {
        totalDocuments,
        totalProcessed,
        totalFailed,
        averageProcessingTime: avgProcessingTime,
        averageAccuracy: avgAccuracy
      }
    };

    res.status(200).json({ success: true, data: analyticsData });
  } catch (error: any) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch analytics data' 
    });
  }
}
