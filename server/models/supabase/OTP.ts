import { getConnection } from '../../lib/supabase.ts';
import { OTPData } from '@shared/types/index.ts';

export class OTP {
  id?: string;
  email: string;
  otp_code: string;
  expires_at: string;
  used?: boolean;
  user_info: string | object;
  created_at?: string;

  constructor(data: OTPData & { user_info?: string | object; id?: string }) {
    this.id = data.id;
    this.email = data.email;
    this.otp_code = data.otp_code;
    this.expires_at = typeof data.expires_at === 'string' ? data.expires_at : data.expires_at.toISOString();
    this.used = data.used;
    this.user_info = data.user_info || '';
    this.created_at = data.created_at as string;
  }

  static async create(otpData: Omit<OTPData, 'id' | 'created_at'>): Promise<string> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('otps')
      .insert({
        email: otpData.email,
        otp_code: otpData.otp_code,
        expires_at: typeof otpData.expires_at === 'string' ? otpData.expires_at : otpData.expires_at.toISOString(),
        user_info: JSON.stringify(otpData.user_info || {})
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  static async findByEmail(email: string): Promise<OTP | null> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email)
      .gt('expires_at', new Date().toISOString())
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return new OTP(data);
  }

  static async verifyOTP(email: string, otpCode: string): Promise<OTP | null> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email)
      .eq('otp_code', otpCode)
      .gt('expires_at', new Date().toISOString())
      .eq('used', false)
      .single();

    if (error || !data) return null;
    return new OTP(data);
  }

  static async markAsUsed(id: string): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('otps')
      .update({ used: true })
      .eq('id', id);

    if (error) throw error;
  }

  static async delete(id: string): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('otps')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async update(id: string, updateData: Partial<OTPData>): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('otps')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  }

  static async cleanupExpired(): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('otps')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) throw error;
  }
}

