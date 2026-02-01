import { getConnection } from '../../lib/mysql.ts';
import { FAQ } from '@shared/types/index.ts';

interface FAQData {
  id?: number | string;
  title?: string;
  question?: string;
  description?: string;
  answer?: string;
  status?: 'active' | 'banned';
  created_at?: Date | string;
  updated_at?: Date | string;
}

export class FAQModel {
  id?: number | string;
  title: string;
  question: string;
  description: string;
  answer: string;
  status: 'active' | 'banned';
  created_at?: Date | string;
  updated_at?: Date | string;

  constructor(data: FAQData) {
    this.id = data.id;
    this.title = data.title || data.question || '';
    this.question = data.question || data.title || '';
    this.description = data.description || data.answer || '';
    this.answer = data.answer || data.description || '';
    this.status = (data.status as 'active' | 'banned') || 'active';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(faqData: Omit<FAQData, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const connection = await getConnection();
    const [result] = await connection.execute(
      'INSERT INTO faqs (title, description, status) VALUES (?, ?, ?)',
      [faqData.title || faqData.question || '', faqData.description || faqData.answer || '', faqData.status || 'active']
    ) as any;
    return result.insertId;
  }

  static async findById(id: number | string): Promise<FAQModel | null> {
    const connection = await getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM faqs WHERE id = ?',
      [id]
    ) as any;
    return rows.length > 0 ? new FAQModel(rows[0]) : null;
  }

  static async findAll(): Promise<FAQModel[]> {
    const connection = await getConnection();
    const [rows] = await connection.execute('SELECT * FROM faqs ORDER BY created_at DESC') as any;
    return rows.map((row: FAQData) => new FAQModel(row));
  }

  static async findActive(): Promise<FAQModel[]> {
    const connection = await getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM faqs WHERE status = "active" ORDER BY created_at DESC'
    ) as any;
    return rows.map((row: FAQData) => new FAQModel(row));
  }

  static async update(id: number | string, updateData: Partial<FAQData>): Promise<void> {
    const connection = await getConnection();
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateData);
    values.push(id);

    await connection.execute(
      `UPDATE faqs SET ${fields}, updated_at = NOW() WHERE id = ?`,
      values
    );
  }

  static async delete(id: number | string): Promise<void> {
    const connection = await getConnection();
    await connection.execute('DELETE FROM faqs WHERE id = ?', [id]);
  }
}

// Export as FAQ for backward compatibility
export const FAQ = FAQModel;

