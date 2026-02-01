import { getConnection } from '../../lib/mysql.ts';

interface CommentData {
  id?: number | string;
  user_id: number | string;
  document_id: number | string;
  content: string;
  reply?: string | null;
  created_at?: Date | string;
  replied_at?: Date | string;
  user_name?: string;
  user_email?: string;
}

class Comment {
  id?: number | string;
  user_id: number | string;
  document_id: number | string;
  content: string;
  reply?: string | null;
  created_at?: Date | string;
  replied_at?: Date | string;
  user_name?: string;
  user_email?: string;

  constructor(data: CommentData) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.document_id = data.document_id;
    this.content = data.content;
    this.reply = data.reply;
    this.created_at = data.created_at;
    this.replied_at = data.replied_at;
    this.user_name = data.user_name;
    this.user_email = data.user_email;
  }

  static async create(commentData: Omit<CommentData, 'id' | 'created_at' | 'replied_at' | 'user_name' | 'user_email'>): Promise<number> {
    const connection = await getConnection();
    try {
      const query = `
        INSERT INTO comments (user_id, document_id, content)
        VALUES (?, ?, ?)
      `;

      const [result] = await connection.execute(query, [
        commentData.user_id,
        commentData.document_id,
        commentData.content
      ]) as any;

      return result.insertId;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async findByDocumentId(documentId: number | string): Promise<Comment[]> {
    const connection = await getConnection();
    try {
      const query = `
        SELECT c.*, u.name as user_name, u.email as user_email
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.document_id = ?
        ORDER BY c.created_at DESC
      `;

      const [rows] = await connection.execute(query, [documentId]) as any;
      return rows.map((row: CommentData) => new Comment(row));
    } finally {
      // Connection pool is managed globally
    }
  }

  static async findById(id: number | string): Promise<Comment | null> {
    const connection = await getConnection();
    try {
      const query = `
        SELECT c.*, u.name as user_name, u.email as user_email
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `;

      const [rows] = await connection.execute(query, [id]) as any;
      return rows[0] ? new Comment(rows[0]) : null;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async addReply(id: number | string, reply: string): Promise<boolean> {
    const connection = await getConnection();
    try {
      const query = `
        UPDATE comments 
        SET reply = ?, replied_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const [result] = await connection.execute(query, [reply, id]) as any;
      return result.affectedRows > 0;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async delete(id: number | string): Promise<boolean> {
    const connection = await getConnection();
    try {
      const query = 'DELETE FROM comments WHERE id = ?';
      const [result] = await connection.execute(query, [id]) as any;
      return result.affectedRows > 0;
    } finally {
      // Connection pool is managed globally
    }
  }
}

export default Comment;

