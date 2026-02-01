import mysql from 'mysql2/promise';
import { Pool } from 'mysql2/promise';

interface DBConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
  waitForConnections: boolean;
  connectionLimit: number;
  queueLimit: number;
}

const dbConfig: DBConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'scaptract',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool: Pool | null = null;

export async function getConnection(): Promise<Pool> {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

export async function connectDB(): Promise<Pool> {
  try {
    const connection = await getConnection();
    console.log('Connected to MySQL database');
    return connection;
  } catch (error) {
    console.error('MySQL connection error:', error);
    throw error;
  }
}

export async function closeDB(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

