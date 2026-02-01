import { getConnection } from '../../lib/mysql.ts';

interface ExtractionResultData {
  id?: number | string;
  document_id: number | string;
  extracted_text?: string | null;
  structured_data?: string | null;
  accuracy?: number;
  processing_time_ms?: number;
  extraction_method?: string;
  status?: string;
  error_message?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  file_name?: string;
  original_name?: string;
  user_name?: string;
}

class ExtractionResult {
  id?: number | string;
  document_id: number | string;
  extracted_text?: string | null;
  structured_data?: string | null;
  accuracy?: number;
  processing_time_ms?: number;
  extraction_method?: string;
  status?: string;
  error_message?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  file_name?: string;
  original_name?: string;
  user_name?: string;

  constructor(data: ExtractionResultData) {
    this.id = data.id;
    this.document_id = data.document_id;
    this.extracted_text = data.extracted_text;
    this.structured_data = data.structured_data;
    this.accuracy = data.accuracy;
    this.processing_time_ms = data.processing_time_ms;
    this.extraction_method = data.extraction_method;
    this.status = data.status;
    this.error_message = data.error_message;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.file_name = data.file_name;
    this.original_name = data.original_name;
    this.user_name = data.user_name;
  }

  static async create(extractionData: Omit<ExtractionResultData, 'id' | 'created_at' | 'updated_at' | 'file_name' | 'original_name' | 'user_name'>): Promise<number> {
    const connection = await getConnection();
    try {
      const query = `
        INSERT INTO extraction_results (
          document_id, extracted_text, structured_data, 
          accuracy, processing_time_ms, extraction_method, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await connection.execute(query, [
        extractionData.document_id,
        extractionData.extracted_text || null,
        extractionData.structured_data || null,
        extractionData.accuracy || 0.0,
        extractionData.processing_time_ms || 0,
        extractionData.extraction_method || 'ocr',
        extractionData.status || 'completed'
      ]) as any;

      return result.insertId;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async findByDocumentId(documentId: number | string): Promise<ExtractionResult[]> {
    const connection = await getConnection();
    try {
      const query = `
        SELECT er.*, d.file_name, d.original_name
        FROM extraction_results er
        LEFT JOIN documents d ON er.document_id = d.id
        WHERE er.document_id = ?
        ORDER BY er.created_at DESC
      `;

      const [rows] = await connection.execute(query, [documentId]) as any;
      return rows.map((row: ExtractionResultData) => new ExtractionResult(row));
    } finally {
      // Connection pool is managed globally
    }
  }

  static async getByDocumentId(documentId: number | string): Promise<ExtractionResult | null> {
    const results = await this.findByDocumentId(documentId);
    return results.length > 0 ? results[0] : null;
  }

  static async findById(id: number | string): Promise<ExtractionResult | null> {
    const connection = await getConnection();
    try {
      const query = `
        SELECT er.*, d.file_name, d.original_name, u.name as user_name
        FROM extraction_results er
        LEFT JOIN documents d ON er.document_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        WHERE er.id = ?
      `;

      const [rows] = await connection.execute(query, [id]) as any;
      return rows.length > 0 ? new ExtractionResult(rows[0]) : null;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async update(id: number | string, updateData: Partial<ExtractionResultData>): Promise<void> {
    const connection = await getConnection();
    try {
      const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updateData);
      values.push(id);

      await connection.execute(
        `UPDATE extraction_results SET ${fields}, updated_at = NOW() WHERE id = ?`,
        values
      );
    } finally {
      // Connection pool is managed globally
    }
  }

  static async updateExtractionResult(
    id: number | string,
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
    id: number | string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    await this.update(id, {
      status,
      error_message: errorMessage || null
    });
  }

  static async delete(id: number | string): Promise<void> {
    const connection = await getConnection();
    try {
      await connection.execute('DELETE FROM extraction_results WHERE id = ?', [id]);
    } finally {
      // Connection pool is managed globally
    }
  }
}

export default ExtractionResult;

