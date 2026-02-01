import { getConnection } from '../../lib/mysql.ts';

interface FileTypeData {
  id?: number | string;
  name: string;
  extension: string;
  mime_type: string;
  is_supported?: boolean;
  max_size_mb?: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

class FileType {
  id?: number | string;
  name: string;
  extension: string;
  mime_type: string;
  is_supported: boolean;
  max_size_mb: number;
  created_at?: Date | string;
  updated_at?: Date | string;

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

  static async create(fileTypeData: Omit<FileTypeData, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const connection = await getConnection();
    try {
      const query = `
        INSERT INTO file_types (name, extension, mime_type, is_supported, max_size_mb)
        VALUES (?, ?, ?, ?, ?)
      `;

      const [result] = await connection.execute(query, [
        fileTypeData.name,
        fileTypeData.extension,
        fileTypeData.mime_type,
        fileTypeData.is_supported ?? true,
        fileTypeData.max_size_mb ?? 50
      ]) as any;

      return result.insertId;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async findById(id: number | string): Promise<FileType | null> {
    const connection = await getConnection();
    try {
      const query = 'SELECT * FROM file_types WHERE id = ?';
      const [rows] = await connection.execute(query, [id]) as any;
      return rows[0] ? new FileType(rows[0]) : null;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async findByExtension(extension: string): Promise<FileType | null> {
    const connection = await getConnection();
    try {
      const query = 'SELECT * FROM file_types WHERE extension = ? AND is_supported = true';
      const [rows] = await connection.execute(query, [extension]) as any;
      return rows[0] ? new FileType(rows[0]) : null;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async getAllSupported(): Promise<FileType[]> {
    const connection = await getConnection();
    try {
      const query = 'SELECT * FROM file_types WHERE is_supported = true ORDER BY name';
      const [rows] = await connection.execute(query) as any;
      return rows.map((row: FileTypeData) => new FileType(row));
    } finally {
      // Connection pool is managed globally
    }
  }

  static async update(id: number | string, fileTypeData: Partial<FileTypeData>): Promise<boolean> {
    const connection = await getConnection();
    try {
      const query = `
        UPDATE file_types 
        SET name = ?, extension = ?, mime_type = ?, 
            is_supported = ?, max_size_mb = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const [result] = await connection.execute(query, [
        fileTypeData.name,
        fileTypeData.extension,
        fileTypeData.mime_type,
        fileTypeData.is_supported,
        fileTypeData.max_size_mb,
        id
      ]) as any;

      return result.affectedRows > 0;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async delete(id: number | string): Promise<boolean> {
    const connection = await getConnection();
    try {
      const query = 'DELETE FROM file_types WHERE id = ?';
      const [result] = await connection.execute(query, [id]) as any;
      return result.affectedRows > 0;
    } finally {
      // Connection pool is managed globally
    }
  }
}

export default FileType;

