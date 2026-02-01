import { getConnection } from '../../lib/mysql.ts';
import { Notification as NotificationType } from '@shared/types/index.ts';

interface NotificationData {
  id?: number | string;
  user_id: number | string;
  title: string;
  message: string;
  type?: string;
  is_read?: boolean;
  read?: boolean;
  created_at?: Date | string;
}

class Notification {
  id?: number | string;
  user_id: number | string;
  title: string;
  message: string;
  type?: string;
  is_read: boolean;
  read: boolean;
  created_at?: Date | string;

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

  static async create(notificationData: Omit<NotificationData, 'id' | 'created_at' | 'read'>): Promise<number> {
    const connection = await getConnection();
    const [result] = await connection.execute(
      'INSERT INTO notifications (user_id, title, message, is_read) VALUES (?, ?, ?, ?)',
      [notificationData.user_id, notificationData.title, notificationData.message, notificationData.is_read || false]
    ) as any;
    return result.insertId;
  }

  static async findById(id: number | string): Promise<Notification | null> {
    const connection = await getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM notifications WHERE id = ?',
      [id]
    ) as any;
    return rows.length > 0 ? new Notification(rows[0]) : null;
  }

  static async findByUserId(userId: number | string): Promise<Notification[]> {
    const connection = await getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    ) as any;
    return rows.map((row: NotificationData) => new Notification(row));
  }

  static async findUnreadByUserId(userId: number | string): Promise<Notification[]> {
    const connection = await getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM notifications WHERE user_id = ? AND is_read = FALSE ORDER BY created_at DESC',
      [userId]
    ) as any;
    return rows.map((row: NotificationData) => new Notification(row));
  }

  static async markAsRead(id: number | string): Promise<void> {
    const connection = await getConnection();
    await connection.execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ?',
      [id]
    );
  }

  static async markAllAsRead(userId: number | string): Promise<void> {
    const connection = await getConnection();
    await connection.execute(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );
  }

  static async delete(id: number | string): Promise<void> {
    const connection = await getConnection();
    await connection.execute('DELETE FROM notifications WHERE id = ?', [id]);
  }
}

export default Notification;

