import { getConnection } from '../../lib/supabase.ts';
import { SupabaseClient } from '@supabase/supabase-js';

interface UserData {
  id?: string;
  name: string;
  email: string;
  password: string;
  role?: 'user' | 'admin';
  status?: 'active' | 'banned';
  profile_image?: string;
  created_at?: string;
  updated_at?: string;
}

class User {
  id?: string;
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  status: 'active' | 'banned';
  profile_image?: string;
  created_at?: string;
  updated_at?: string;

  constructor(data: UserData) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.password = data.password;
    this.role = data.role || 'user';
    this.status = data.status || 'active';
    this.profile_image = data.profile_image;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(userData: Omit<UserData, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('users')
      .insert({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role || 'user',
        status: userData.status || 'active'
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  static async findById(id: string | number): Promise<User | null> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id.toString())
      .single();

    if (error || !data) return null;
    return new User(data);
  }

  static async findByEmail(email: string): Promise<User | null> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) return null;
    return new User(data);
  }

  static async findAll(): Promise<User[]> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: UserData) => new User(row));
  }

  static async update(id: string | number, updateData: Partial<Omit<UserData, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id.toString());

    if (error) throw error;
  }

  static async delete(id: string | number): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id.toString());

    if (error) throw error;
  }
}

export default User;

