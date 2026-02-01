import { getConnection } from '../../lib/supabase.ts';
import { Notification as NotificationType } from '@shared/types/index.ts';

interface NotificationData {
  id?: string;
  user_id: string;
  title: string;
  message: string;
  type?: string;
  is_read?: boolean;
  read?: boolean;
  created_at?: string;
}

class Notification {
  id?: string;
  user_id: string;
  title: string;
  message: string;
  type?: string;
  is_read: boolean;
  read: boolean;
  created_at?: string;

  constructor(data: NotificationData) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.title = data.title;
    this.message = data.message;
    this.type = data.type;
    this.is_read = data.is_read ?? data.read ?? false;
    this.read = data.read ?? data.is_read ?? false;
    this.created_at = data.created_at;
  }

  static async create(notificationData: Omit<NotificationData, 'id' | 'created_at' | 'read'>): Promise<string> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notificationData.user_id,
        title: notificationData.title,
        message: notificationData.message,
        is_read: notificationData.is_read || false
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  static async findById(id: string | number): Promise<Notification | null> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id.toString())
      .single();

    if (error || !data) return null;
    return new Notification(data);
  }

  static async findByUserId(userId: string | number): Promise<Notification[]> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId.toString())
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: NotificationData) => new Notification(row));
  }

  static async findUnreadByUserId(userId: string | number): Promise<Notification[]> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId.toString())
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: NotificationData) => new Notification(row));
  }

  static async markAsRead(id: string | number): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id.toString());

    if (error) throw error;
  }

  static async markAllAsRead(userId: string | number): Promise<void> {
    const supabase = getConnection();
  
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId.toString())
      .eq('is_read', false);
  
    if (error) throw error;
  }
  

  static async delete(id: string | number): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id.toString());

    if (error) throw error;
  }
}

export default Notification;

