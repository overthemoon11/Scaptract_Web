import { getConnection } from '../../lib/supabase.ts';

interface ExtractionResultData {
  id?: string;
  document_id?: string | null; // Nullable for group-level results
  group_name?: string | null; // For group-level results
  extracted_text?: string | null;
  structured_data?: any | null;
  accuracy?: number;
  processing_time_ms?: number;
  extraction_method?: string;
  status?: string;
  error_message?: string | null;
  ocr_result_path?: string | null; // Base path where OCR markdown/images are saved (e.g., uploads/ocr-results/{groupname}/)
  created_at?: string;
  updated_at?: string;
  file_name?: string;
  original_name?: string;
  user_name?: string;
}

class ExtractionResult {
  id?: string;
  document_id?: string | null; // Nullable for group-level results
  group_name?: string | null; // For group-level results
  extracted_text?: string | null;
  structured_data?: any | null;
  accuracy?: number;
  processing_time_ms?: number;
  extraction_method?: string;
  status?: string;
  error_message?: string | null;
  ocr_result_path?: string | null; // Base path where OCR markdown/images are saved
  created_at?: string;
  updated_at?: string;
  file_name?: string;
  original_name?: string;
  user_name?: string;

  constructor(data: ExtractionResultData) {
    this.id = data.id;
    this.document_id = data.document_id;
    this.group_name = data.group_name;
    this.extracted_text = data.extracted_text;
    this.structured_data = data.structured_data;
    this.accuracy = data.accuracy;
    this.processing_time_ms = data.processing_time_ms;
    this.extraction_method = data.extraction_method;
    this.status = data.status;
    this.error_message = data.error_message;
    this.ocr_result_path = data.ocr_result_path;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.file_name = data.file_name;
    this.original_name = data.original_name;
    this.user_name = data.user_name;
  }

  static async create(extractionData: Omit<ExtractionResultData, 'id' | 'created_at' | 'updated_at' | 'file_name' | 'original_name' | 'user_name'>): Promise<string> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('extraction_results')
      .insert({
        document_id: extractionData.document_id || null,
        group_name: extractionData.group_name || null,
        extracted_text: extractionData.extracted_text || null,
        structured_data: extractionData.structured_data || null,
        accuracy: extractionData.accuracy || 0.0,
        processing_time_ms: extractionData.processing_time_ms || 0,
        extraction_method: extractionData.extraction_method || 'ocr',
        status: extractionData.status || 'completed'
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  static async findByDocumentId(documentId: string | number): Promise<ExtractionResult[]> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('extraction_results')
      .select('*, documents(file_name, original_name)')
      .eq('document_id', documentId.toString())
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: any) => {
      const result = new ExtractionResult(row);
      if (row.documents) {
        result.file_name = row.documents.file_name;
        result.original_name = row.documents.original_name;
      }
      return result;
    });
  }

  static async getByDocumentId(documentId: string | number): Promise<ExtractionResult | null> {
    const results = await this.findByDocumentId(documentId);
    return results.length > 0 ? results[0] : null;
  }

  static async findById(id: string | number): Promise<ExtractionResult | null> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('extraction_results')
      .select('*, documents(file_name, original_name, users(name))')
      .eq('id', id.toString())
      .single();

    if (error || !data) return null;
    const result = new ExtractionResult(data);
    if (data.documents) {
      result.file_name = data.documents.file_name;
      result.original_name = data.documents.original_name;
      if (data.documents.users) {
        result.user_name = data.documents.users.name;
      }
    }
    return result;
  }

  static async update(id: string | number, updateData: Partial<ExtractionResultData>): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('extraction_results')
      .update(updateData)
      .eq('id', id.toString());

    if (error) throw error;
  }

  static async updateExtractionResult(
    id: string | number,
    extractedText: string,
    confidence: number,
    processingTime: number
  ): Promise<void> {
    await this.update(id, {
      extracted_text: extractedText,
      accuracy: confidence,
      processing_time_ms: processingTime,
      status: 'completed'
    });
  }

  static async updateStatus(
    id: string | number,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      error_message: errorMessage || null
    };
    
    await this.update(id, updateData);
  }

  static async delete(id: string | number): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('extraction_results')
      .delete()
      .eq('id', id.toString());

    if (error) throw error;
  }
}

export default ExtractionResult;

