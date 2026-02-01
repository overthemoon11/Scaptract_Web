import { getConnection } from '../../lib/mysql.ts';
import { SupportTicket as SupportTicketType } from '@shared/types/index.ts';

interface SupportTicketData {
  id?: number | string;
  title: string;
  description?: string;
  message?: string;
  status?: 'pending' | 'solved' | 'in_progress';
  user_id: number | string;
  created_at?: Date | string;
  updated_at?: Date | string;
  user_name?: string;
  user_email?: string;
}

export class SupportTicket {
  id?: number | string;
  title: string;
  description: string;
  message: string;
  status: 'pending' | 'solved' | 'in_progress';
  user_id: number | string;
  created_at?: Date | string;
  updated_at?: Date | string;
  user_name?: string;
  user_email?: string;

  constructor(data: SupportTicketData) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description || data.message || '';
    this.message = data.message || data.description || '';
    this.status = (data.status as 'pending' | 'solved' | 'in_progress') || 'pending';
    this.user_id = data.user_id;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.user_name = data.user_name;
    this.user_email = data.user_email;
  }

  static async create(ticketData: Omit<SupportTicketData, 'id' | 'created_at' | 'updated_at' | 'user_name' | 'user_email'>): Promise<number> {
    const connection = await getConnection();
    const [result] = await connection.execute(
      'INSERT INTO support_tickets (title, description, status, user_id) VALUES (?, ?, ?, ?)',
      [ticketData.title, ticketData.description || ticketData.message || '', ticketData.status || 'pending', ticketData.user_id]
    ) as any;
    return result.insertId;
  }

  static async findById(id: number | string): Promise<SupportTicket | null> {
    const connection = await getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM support_tickets WHERE id = ?',
      [id]
    ) as any;
    return rows.length > 0 ? new SupportTicket(rows[0]) : null;
  }

  static async findByUserId(userId: number | string): Promise<SupportTicket[]> {
    const connection = await getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    ) as any;
    return rows.map((row: SupportTicketData) => new SupportTicket(row));
  }

  static async findAll(): Promise<SupportTicket[]> {
    const connection = await getConnection();
    const [rows] = await connection.execute(
      'SELECT st.*, u.name as user_name, u.email as user_email FROM support_tickets st LEFT JOIN users u ON st.user_id = u.id ORDER BY st.created_at DESC'
    ) as any;
    return rows.map((row: SupportTicketData) => new SupportTicket(row));
  }

  static async update(id: number | string, updateData: Partial<SupportTicketData>): Promise<void> {
    const connection = await getConnection();
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateData);
    values.push(id);

    await connection.execute(
      `UPDATE support_tickets SET ${fields}, updated_at = NOW() WHERE id = ?`,
      values
    );
  }

  static async delete(id: number | string): Promise<void> {
    const connection = await getConnection();
    await connection.execute('DELETE FROM support_tickets WHERE id = ?', [id]);
  }
}

