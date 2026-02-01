import { getConnection } from '../../lib/mysql.ts';
import { Document as DocumentType } from '@shared/types/index.ts';

interface DocumentData {
  id?: number | string;
  user_id: number | string;
  file_type_id: number | string;
  file_id?: string | null;
  group_name?: string | null;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  page_count?: number;
  status: string;
  processing_started_at?: Date | string;
  processing_completed_at?: Date | string;
  created_at?: Date | string;
  updated_at?: Date | string;
  file_type_name?: string;
  user_name?: string;
  user_email?: string;
}

interface ProcessingData {
  processing_started_at?: Date | string;
  processing_completed_at?: Date | string;
}

interface DocumentStats {
  total_documents: number;
  completed_documents: number;
  processing_documents: number;
  failed_documents: number;
}

class Document {
  id?: number | string;
  user_id: number | string;
  file_type_id: number | string;
  file_id?: string | null;
  group_name?: string | null;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  page_count?: number;
  status: string;
  processing_started_at?: Date | string;
  processing_completed_at?: Date | string;
  created_at?: Date | string;
  updated_at?: Date | string;
  file_type_name?: string;
  user_name?: string;
  user_email?: string;

  constructor(data: DocumentData) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.file_type_id = data.file_type_id;
    this.file_id = data.file_id;
    this.group_name = data.group_name;
    this.file_name = data.file_name;
    this.original_name = data.original_name;
    this.file_path = data.file_path;
    this.file_size = data.file_size;
    this.mime_type = data.mime_type;
    this.page_count = data.page_count;
    this.status = data.status;
    this.processing_started_at = data.processing_started_at;
    this.processing_completed_at = data.processing_completed_at;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.file_type_name = data.file_type_name;
    this.user_name = data.user_name;
    this.user_email = data.user_email;
  }

  static async create(documentData: Omit<DocumentData, 'id' | 'created_at' | 'updated_at' | 'file_type_name' | 'user_name' | 'user_email'>): Promise<number> {
    const connection = await getConnection();
    try {
      const query = `
        INSERT INTO documents (
          user_id, file_type_id, file_id, group_name, file_name, original_name, 
          file_path, file_size, mime_type, page_count, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await connection.execute(query, [
        documentData.user_id,
        documentData.file_type_id,
        documentData.file_id || null,
        documentData.group_name || null,
        documentData.file_name,
        documentData.original_name,
        documentData.file_path,
        documentData.file_size,
        documentData.mime_type,
        documentData.page_count || 0,
        documentData.status || 'uploaded'
      ]) as any;

      return result.insertId;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async findById(id: number | string): Promise<Document | null> {
    const connection = await getConnection();
    try {
      const query = `
        SELECT d.*, ft.name as file_type_name, u.name as user_name, u.email as user_email
        FROM documents d
        LEFT JOIN file_types ft ON d.file_type_id = ft.id
        LEFT JOIN users u ON d.user_id = u.id
        WHERE d.id = ?
      `;

      const [rows] = await connection.execute(query, [id]) as any;
      return rows[0] ? new Document(rows[0]) : null;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async findByUserId(userId: number | string, limit: number = 50, offset: number = 0): Promise<Document[]> {
    const connection = await getConnection();
    try {
      const query = `
        SELECT d.*, ft.name as file_type_name
        FROM documents d
        LEFT JOIN file_types ft ON d.file_type_id = ft.id
        WHERE d.user_id = ?
        ORDER BY d.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const [rows] = await connection.execute(query, [userId, limit, offset]) as any;
      return rows.map((row: DocumentData) => new Document(row));
    } finally {
      // Connection pool is managed globally
    }
  }

  static async updateStatus(id: number | string, status: string, processingData: ProcessingData = {}): Promise<boolean> {
    const connection = await getConnection();
    try {
      let query = 'UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP';
      let params: any[] = [status];

      if (status === 'processing' && processingData.processing_started_at) {
        query += ', processing_started_at = ?';
        params.push(processingData.processing_started_at);
      }

      if (status === 'completed' && processingData.processing_completed_at) {
        query += ', processing_completed_at = ?';
        params.push(processingData.processing_completed_at);
      }

      query += ' WHERE id = ?';
      params.push(id);

      const [result] = await connection.execute(query, params) as any;
      return result.affectedRows > 0;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async delete(id: number | string): Promise<boolean> {
    const connection = await getConnection();
    try {
      const query = 'DELETE FROM documents WHERE id = ?';
      const [result] = await connection.execute(query, [id]) as any;
      return result.affectedRows > 0;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async deleteByFileId(fileId: string, userId: number | string): Promise<{ deletedCount: number; filePaths: string[] }> {
    const connection = await getConnection();
    try {
      // First, get all documents with this file_id to get file paths and verify ownership
      const selectQuery = `
        SELECT id, file_path, user_id
        FROM documents
        WHERE file_id = ? AND user_id = ?
      `;
      const [rows] = await connection.execute(selectQuery, [fileId, userId]) as any;

      if (!rows || rows.length === 0) {
        return { deletedCount: 0, filePaths: [] };
      }

      // Get file paths before deletion
      const filePaths = rows.map((row: any) => row.file_path).filter((path: string) => path);

      // Delete all documents with this file_id (cascade will handle related data)
      const deleteQuery = 'DELETE FROM documents WHERE file_id = ? AND user_id = ?';
      const [result] = await connection.execute(deleteQuery, [fileId, userId]) as any;

      return { deletedCount: result.affectedRows, filePaths };
    } finally {
      // Connection pool is managed globally
    }
  }

  static async getStats(): Promise<DocumentStats> {
    const connection = await getConnection();
    try {
      const query = `
        SELECT 
          COUNT(*) as total_documents,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_documents,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_documents,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_documents
        FROM documents
      `;

      const [rows] = await connection.execute(query) as any;
      return rows[0] as DocumentStats;
    } finally {
      // Connection pool is managed globally
    }
  }
}

export default Document;

