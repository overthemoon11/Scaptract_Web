import { getConnection } from '../../lib/supabase.ts';

interface FileTypeData {
  id?: string;
  name: string;
  extension: string;
  mime_type: string;
  is_supported?: boolean;
  max_size_mb?: number;
  created_at?: string;
  updated_at?: string;
}

class FileType {
  id?: string;
  name: string;
  extension: string;
  mime_type: string;
  is_supported: boolean;
  max_size_mb: number;
  created_at?: string;
  updated_at?: string;

  constructor(data: FileTypeData) {
    this.id = data.id;
    this.name = data.name;
    this.extension = data.extension;
    this.mime_type = data.mime_type;
    this.is_supported = data.is_supported ?? true;
    this.max_size_mb = data.max_size_mb ?? 50;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(fileTypeData: Omit<FileTypeData, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('file_types')
      .insert({
        name: fileTypeData.name,
        extension: fileTypeData.extension,
        mime_type: fileTypeData.mime_type,
        is_supported: fileTypeData.is_supported ?? true,
        max_size_mb: fileTypeData.max_size_mb ?? 50
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  static async findById(id: string | number): Promise<FileType | null> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('file_types')
      .select('*')
      .eq('id', id.toString())
      .single();

    if (error || !data) return null;
    return new FileType(data);
  }

  static async findByExtension(extension: string): Promise<FileType | null> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('file_types')
      .select('*')
      .eq('extension', extension)
      .eq('is_supported', true)
      .single();

    if (error || !data) return null;
    return new FileType(data);
  }

  static async getAllSupported(): Promise<FileType[]> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('file_types')
      .select('*')
      .eq('is_supported', true)
      .order('name', { ascending: true });

    if (error || !data) return [];
    return data.map((row: FileTypeData) => new FileType(row));
  }

  static async update(id: string | number, fileTypeData: Partial<FileTypeData>): Promise<boolean> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('file_types')
      .update(fileTypeData)
      .eq('id', id.toString());

    if (error) throw error;
    return true;
  }

  static async delete(id: string | number): Promise<boolean> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('file_types')
      .delete()
      .eq('id', id.toString());

    if (error) throw error;
    return true;
  }
}

export default FileType;

