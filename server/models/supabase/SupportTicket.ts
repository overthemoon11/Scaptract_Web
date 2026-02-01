import { getConnection } from '../../lib/supabase.ts';
import { SupportTicket as SupportTicketType } from '@shared/types/index.ts';

interface SupportTicketData {
  id?: string;
  title: string;
  description?: string;
  message?: string;
  status?: 'pending' | 'solved' | 'in_progress';
  user_id: string;
  created_at?: string;
  updated_at?: string;
  user_name?: string;
  user_email?: string;
}

export class SupportTicket {
  id?: string;
  title: string;
  description: string;
  message: string;
  status: 'pending' | 'solved' | 'in_progress';
  user_id: string;
  created_at?: string;
  updated_at?: string;
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

  static async create(ticketData: Omit<SupportTicketData, 'id' | 'created_at' | 'updated_at' | 'user_name' | 'user_email'>): Promise<string> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        title: ticketData.title,
        description: ticketData.description || ticketData.message || '',
        status: ticketData.status || 'pending',
        user_id: ticketData.user_id
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  static async findById(id: string | number): Promise<SupportTicket | null> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*, users(name, email)')
      .eq('id', id.toString())
      .single();

    if (error || !data) return null;
    const ticket = new SupportTicket(data);
    if (data.users) {
      ticket.user_name = data.users.name;
      ticket.user_email = data.users.email;
    }
    return ticket;
  }

  static async findByUserId(userId: string | number): Promise<SupportTicket[]> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId.toString())
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: SupportTicketData) => new SupportTicket(row));
  }

  static async findAll(): Promise<SupportTicket[]> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*, users(name, email)')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: any) => {
      const ticket = new SupportTicket(row);
      if (row.users) {
        ticket.user_name = row.users.name;
        ticket.user_email = row.users.email;
      }
      return ticket;
    });
  }

  static async update(id: string | number, updateData: Partial<SupportTicketData>): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', id.toString());

    if (error) throw error;
  }

  static async delete(id: string | number): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('support_tickets')
      .delete()
      .eq('id', id.toString());

    if (error) throw error;
  }
}

export default SupportTicket;

