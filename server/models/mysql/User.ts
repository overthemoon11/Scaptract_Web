import { getConnection } from '../../lib/mysql.ts';
import { Pool } from 'mysql2/promise';

interface UserData {
  id?: number;
  name: string;
  email: string;
  password: string;
  role?: 'user' | 'admin';
  status?: 'active' | 'banned';
  created_at?: Date;
  updated_at?: Date;
}

class User {
  id?: number;
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  status: 'active' | 'banned';
  created_at?: Date;
  updated_at?: Date;

  constructor(data: UserData) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.password = data.password;
    this.role = data.role || 'user';
    this.status = data.status || 'active';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(userData: Omit<UserData, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const connection = await getConnection();
    const [result] = await connection.execute(
      'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
      [userData.name, userData.email, userData.password, userData.role || 'user', userData.status || 'active']
    ) as any;
    return result.insertId;
  }

  static async findById(id: number | string): Promise<User | null> {
    const connection = await getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM users WHERE id = ?',
      [id]
    ) as any;
    return rows.length > 0 ? new User(rows[0]) : null;
  }

  static async findByEmail(email: string): Promise<User | null> {
    const connection = await getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    ) as any;
    return rows.length > 0 ? new User(rows[0]) : null;
  }

  static async findAll(): Promise<User[]> {
    const connection = await getConnection();
    const [rows] = await connection.execute('SELECT * FROM users ORDER BY created_at DESC') as any;
    return rows.map((row: UserData) => new User(row));
  }

  static async update(id: number | string, updateData: Partial<Omit<UserData, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    const connection = await getConnection();
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateData);
    values.push(id);

    await connection.execute(
      `UPDATE users SET ${fields}, updated_at = NOW() WHERE id = ?`,
      values
    );
  }

  static async delete(id: number | string): Promise<void> {
    const connection = await getConnection();
    await connection.execute('DELETE FROM users WHERE id = ?', [id]);
  }
}

export default User;

