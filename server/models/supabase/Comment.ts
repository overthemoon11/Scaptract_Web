import { getConnection } from '../../lib/supabase.ts';

interface CommentData {
  id?: string;
  user_id: string;
  document_id: string;
  content: string;
  reply?: string | null;
  created_at?: string;
  replied_at?: string;
  user_name?: string;
  user_email?: string;
}

class Comment {
  id?: string;
  user_id: string;
  document_id: string;
  content: string;
  reply?: string | null;
  created_at?: string;
  replied_at?: string;
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

  static async create(commentData: Omit<CommentData, 'id' | 'created_at' | 'replied_at' | 'user_name' | 'user_email'>): Promise<string> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('comments')
      .insert({
        user_id: commentData.user_id,
        document_id: commentData.document_id,
        content: commentData.content
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  static async findByDocumentId(documentId: string | number): Promise<Comment[]> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('comments')
      .select('*, users(name, email)')
      .eq('document_id', documentId.toString())
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: any) => {
      const comment = new Comment(row);
      if (row.users) {
        comment.user_name = row.users.name;
        comment.user_email = row.users.email;
      }
      return comment;
    });
  }

  static async findById(id: string | number): Promise<Comment | null> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('comments')
      .select('*, users(name, email)')
      .eq('id', id.toString())
      .single();

    if (error || !data) return null;
    const comment = new Comment(data);
    if (data.users) {
      comment.user_name = data.users.name;
      comment.user_email = data.users.email;
    }
    return comment;
  }

  static async addReply(id: string | number, reply: string): Promise<boolean> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('comments')
      .update({
        reply,
        replied_at: new Date().toISOString()
      })
      .eq('id', id.toString());

    if (error) throw error;
    return true;
  }

  static async delete(id: string | number): Promise<boolean> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id.toString());

    if (error) throw error;
    return true;
  }
}

export default Comment;

