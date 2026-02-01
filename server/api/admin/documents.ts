import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import { getConnection } from '../../lib/supabase.ts';

export default async function handler(req: Request, res: Response) {
  try {
    await requireAuth(req, 'admin');
    const supabase = getConnection();

    // Fetch all documents with user and file type info
    const { data: documents, error } = await supabase
      .from('documents')
      .select(`
        *,
        file_types(name),
        users(name, id)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const documentsWithUsers = (documents || []).map((doc: any) => ({
      id: doc.id.toString(),
      file_name: doc.file_name,
      original_name: doc.original_name,
      group_name: doc.group_name || null,
      display_name: doc.display_name || null,
      file_type_name: doc.file_types?.name || null,
      mime_type: doc.mime_type,
      status: doc.status || 'uploaded',
      user_id: doc.user_id ? doc.user_id.toString() : '',
      user_name: doc.users?.name || 'Unknown',
      created_at: doc.created_at || null,
      page_count: doc.page_count || 0
    }));

    return res.status(200).json({
      documents: documentsWithUsers
    });
  } catch (err: any) {
    console.error('Error fetching documents:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch documents' });
  }
}
