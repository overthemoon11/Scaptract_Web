import { getConnection } from '../../lib/mysql.ts';
import { OTPData } from '@shared/types/index.ts';

export class OTP {
  id?: number;
  email: string;
  otp_code: string;
  expires_at: Date | string;
  used?: boolean;
  user_info: string | object;
  created_at?: Date | string;

  constructor(data: OTPData & { user_info?: string | object }) {
    this.id = data.id;
    this.email = data.email;
    this.otp_code = data.otp_code;
    this.expires_at = data.expires_at;
    this.used = data.used;
    this.user_info = data.user_info || '';
    this.created_at = data.created_at;
  }

  static async create(otpData: Omit<OTPData, 'id' | 'created_at'>): Promise<number> {
    const connection = await getConnection();
    const [result] = await connection.execute(
      'INSERT INTO otps (email, otp_code, expires_at, user_info) VALUES (?, ?, ?, ?)',
      [otpData.email, otpData.otp_code, otpData.expires_at, JSON.stringify(otpData.user_info || {})]
    ) as any;
    return result.insertId;
  }

  static async findByEmail(email: string): Promise<OTP | null> {
    const connection = await getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM otps WHERE email = ? AND expires_at > NOW() AND used = FALSE ORDER BY created_at DESC LIMIT 1',
      [email]
    ) as any;
    return rows.length > 0 ? new OTP(rows[0]) : null;
  }

  static async verifyOTP(email: string, otpCode: string): Promise<OTP | null> {
    const connection = await getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM otps WHERE email = ? AND otp_code = ? AND expires_at > NOW() AND used = FALSE',
      [email, otpCode]
    ) as any;
    return rows.length > 0 ? new OTP(rows[0]) : null;
  }

  static async markAsUsed(id: number): Promise<void> {
    const connection = await getConnection();
    await connection.execute(
      'UPDATE otps SET used = TRUE WHERE id = ?',
      [id]
    );
  }

  static async delete(id: number): Promise<void> {
    const connection = await getConnection();
    await connection.execute(
      'DELETE FROM otps WHERE id = ?',
      [id]
    );
  }

  static async update(id: number, updateData: Partial<OTPData>): Promise<void> {
    const connection = await getConnection();
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateData);
    values.push(id);

    await connection.execute(
      `UPDATE otps SET ${fields} WHERE id = ?`,
      values
    );
  }

  static async cleanupExpired(): Promise<void> {
    const connection = await getConnection();
    await connection.execute(
      'DELETE FROM otps WHERE expires_at < NOW()'
    );
  }
}

