import { Request, Response } from 'express';
import { getConnection } from '../../lib/supabase.ts';
import { requireAuth } from '../../lib/auth.ts';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify user is admin
    await requireAuth(req, 'admin');

    const format = (req.query.format as string)?.toLowerCase() || 'csv';
    if (format !== 'csv' && format !== 'pdf') {
      return res.status(400).json({ error: 'Invalid format. Use csv or pdf' });
    }

    // Fetch analytics data (reuse logic from index.ts)
    const supabase = getConnection();
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get documents
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('created_at, status, mime_type')
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: true });

    if (docsError) throw docsError;

    // Get extraction results
    const { data: extractions, error: extractionsError } = await supabase
      .from('extraction_results')
      .select('created_at, updated_at, processing_time_ms, accuracy, status, document_id')
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: true });

    if (extractionsError) throw extractionsError;

    // Get document mime_types
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

    // Calculate stats
    const totalDocuments = documents?.length || 0;
    const totalProcessed = documents?.filter((d: any) => d.status === 'completed').length || 0;
    const totalFailed = documents?.filter((d: any) => d.status === 'failed').length || 0;
    
    const completedExtractions = extractions?.filter((e: any) => e.status === 'completed') || [];
    const processingTimes: number[] = [];
    completedExtractions.forEach((ext: any) => {
      let calculatedTime: number | null = null;
      if (ext.processing_time_ms && ext.processing_time_ms > 0) {
        calculatedTime = ext.processing_time_ms;
      } else if (ext.created_at && ext.updated_at) {
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

    // Calculate OCR accuracy by type
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

    if (format === 'csv') {
      // Generate CSV manually
      const csvRows: string[] = [];
      csvRows.push('Metric,Value');
      csvRows.push(`Total Documents,${totalDocuments}`);
      csvRows.push(`Total Processed,${totalProcessed}`);
      csvRows.push(`Total Failed,${totalFailed}`);
      csvRows.push(`Average Processing Time (ms),${avgProcessingTime}`);
      csvRows.push(`Average OCR Accuracy (%),${avgAccuracy.toFixed(2)}`);
      csvRows.push('');
      csvRows.push('OCR Accuracy by Document Type');
      csvRows.push('Document Type,Average Accuracy (%),Document Count');
      ocrAccuracyByType.forEach((item) => {
        csvRows.push(`${item.type},${item.avgAccuracy.toFixed(2)},${item.count}`);
      });

      const csv = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-report-${new Date().toISOString().split('T')[0]}.csv`);
      res.status(200).send(csv);
    } else {
      // Generate PDF using pdf-lib
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // US Letter size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      let yPosition = 750;
      const margin = 50;
      const lineHeight = 20;
      const titleSize = 18;
      const headingSize = 14;
      const bodySize = 12;

      // Helper function to add text
      const addText = (text: string, x: number, y: number, size: number, isBold: boolean = false) => {
        page.drawText(text, {
          x,
          y,
          size,
          font: isBold ? boldFont : font,
          color: rgb(0, 0, 0),
        });
      };

      // Header
      addText('Analytics Report', margin, yPosition, titleSize, true);
      yPosition -= lineHeight * 1.5;
      addText(`Generated: ${new Date().toLocaleString()}`, margin, yPosition, bodySize);
      yPosition -= lineHeight;
      addText(`Time Range: Last ${days} days`, margin, yPosition, bodySize);
      yPosition -= lineHeight * 2;

      // Summary Statistics
      addText('Summary Statistics', margin, yPosition, headingSize, true);
      yPosition -= lineHeight * 1.5;
      addText(`Total Documents: ${totalDocuments}`, margin, yPosition, bodySize);
      yPosition -= lineHeight;
      addText(`Total Processed: ${totalProcessed}`, margin, yPosition, bodySize);
      yPosition -= lineHeight;
      addText(`Total Failed: ${totalFailed}`, margin, yPosition, bodySize);
      yPosition -= lineHeight;
      addText(`Average Processing Time: ${(avgProcessingTime / 1000).toFixed(2)}s`, margin, yPosition, bodySize);
      yPosition -= lineHeight;
      addText(`Average OCR Accuracy: ${avgAccuracy.toFixed(2)}%`, margin, yPosition, bodySize);
      yPosition -= lineHeight * 2;

      // OCR Accuracy by Document Type
      if (ocrAccuracyByType.length > 0) {
        addText('OCR Accuracy by Document Type', margin, yPosition, headingSize, true);
        yPosition -= lineHeight * 1.5;
        ocrAccuracyByType.forEach((item) => {
          if (yPosition < 100) {
            // Add new page if needed
            const newPage = pdfDoc.addPage([612, 792]);
            yPosition = 750;
          }
          addText(`${item.type}: ${item.avgAccuracy.toFixed(2)}% (${item.count} documents)`, margin, yPosition, bodySize);
          yPosition -= lineHeight;
        });
      }

      const pdfBytes = await pdfDoc.save();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-report-${new Date().toISOString().split('T')[0]}.pdf`);
      res.status(200).send(Buffer.from(pdfBytes));
    }
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to export report' 
    });
  }
}
