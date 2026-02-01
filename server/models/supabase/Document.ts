import { getConnection } from '../../lib/supabase.ts';
import { Document as DocumentType } from '@shared/types/index.ts';

interface DocumentData {
  id?: string;
  user_id: string;
  file_type_id: string | null;
  file_id?: string | null;
  group_name?: string | null;
  display_name?: string | null;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  page_count?: number;
  status: string;
  processing_started_at?: string;
  processing_completed_at?: string;
  created_at?: string;
  updated_at?: string;
  file_type_name?: string;
  user_name?: string;
  user_email?: string;
}

interface ProcessingData {
  processing_started_at?: string;
  processing_completed_at?: string;
}

interface DocumentStats {
  total_documents: number;
  completed_documents: number;
  processing_documents: number;
  failed_documents: number;
}

class Document {
  id?: string;
  user_id: string;
  file_type_id: string | null;
  file_id?: string | null;
  group_name?: string | null;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  page_count?: number;
  status: string;
  processing_started_at?: string;
  processing_completed_at?: string;
  created_at?: string;
  updated_at?: string;
  file_type_name?: string;
  user_name?: string;
  user_email?: string;

  constructor(data: DocumentData) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.file_type_id = data.file_type_id;
    this.file_id = data.file_id;
    this.group_name = data.group_name;
    this.display_name = data.display_name;
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

  static async create(documentData: Omit<DocumentData, 'id' | 'created_at' | 'updated_at' | 'file_type_name' | 'user_name' | 'user_email'>): Promise<string> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: documentData.user_id,
        file_type_id: documentData.file_type_id,
        file_id: documentData.file_id,
        group_name: documentData.group_name,
        file_name: documentData.file_name,
        original_name: documentData.original_name,
        file_path: documentData.file_path,
        file_size: documentData.file_size,
        mime_type: documentData.mime_type,
        page_count: documentData.page_count || 0,
        status: documentData.status || 'uploaded'
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  static async findById(id: string | number): Promise<Document | null> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('documents')
      .select('*, file_types(name), users(name, email)')
      .eq('id', id.toString())
      .single();

    if (error || !data) return null;
    const doc = new Document(data);
    if (data.file_types) doc.file_type_name = data.file_types.name;
    if (data.users) {
      doc.user_name = data.users.name;
      doc.user_email = data.users.email;
    }
    return doc;
  }

  static async findByUserId(userId: string | number, limit: number = 50, offset: number = 0): Promise<Document[]> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('documents')
      .select('*, file_types(name)')
      .eq('user_id', userId.toString())
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) return [];
    return data.map((row: any) => {
      const doc = new Document(row);
      if (row.file_types) doc.file_type_name = row.file_types.name;
      return doc;
    });
  }

  static async updateStatus(id: string | number, status: string, processingData: ProcessingData = {}): Promise<boolean> {
    const supabase = getConnection();
    const updateData: any = { status };
    if (status === 'processing' && processingData.processing_started_at) {
      updateData.processing_started_at = processingData.processing_started_at;
    }
    if (status === 'completed' && processingData.processing_completed_at) {
      updateData.processing_completed_at = processingData.processing_completed_at;
    }

    const { error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', id.toString());

    if (error) throw error;
    return true;
  }

  static async delete(id: string | number): Promise<boolean> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id.toString());

    if (error) throw error;
    return true;
  }

  static async deleteByFileId(fileId: string, userId: string | number): Promise<{ deletedCount: number; filePaths: string[] }> {
    const supabase = getConnection();
    
    // First, get all documents with this file_id to get file paths and verify ownership
    const { data: documents, error: fetchError } = await supabase
      .from('documents')
      .select('id, file_path, user_id')
      .eq('file_id', fileId)
      .eq('user_id', userId.toString());

    if (fetchError) throw fetchError;

    if (!documents || documents.length === 0) {
      return { deletedCount: 0, filePaths: [] };
    }

    // Verify all documents belong to the user
    const unauthorizedDocs = documents.filter(doc => doc.user_id !== userId.toString());
    if (unauthorizedDocs.length > 0) {
      throw new Error('Unauthorized: Some documents do not belong to the user');
    }

    // Get file paths before deletion
    const filePaths = documents.map(doc => doc.file_path).filter(path => path);

    // Delete all documents with this file_id (cascade will handle related data)
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('file_id', fileId)
      .eq('user_id', userId.toString());

    if (deleteError) throw deleteError;

    return { deletedCount: documents.length, filePaths };
  }

  static async getStats(): Promise<DocumentStats> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('documents')
      .select('status');

    if (error || !data) {
      return { total_documents: 0, completed_documents: 0, processing_documents: 0, failed_documents: 0 };
    }

    return {
      total_documents: data.length,
      completed_documents: data.filter(d => d.status === 'completed').length,
      processing_documents: data.filter(d => d.status === 'processing').length,
      failed_documents: data.filter(d => d.status === 'failed').length
    };
  }
}

export default Document;

