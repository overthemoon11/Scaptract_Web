import { Request, Response } from 'express';
import { connectDB, getConnection } from '../../../lib/supabase.ts';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';

/**
 * Update group name for all documents in a group
 * PATCH /api/documents/group/update-name
 * Body: { oldGroupName: string, newGroupName: string }
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    // Verify JWT token from cookies
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.token;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: number | string };
    const userId = decoded.userId;

    const { oldGroupName, newGroupName } = req.body;

    if (!oldGroupName || !newGroupName) {
      return res.status(400).json({ error: 'Old group name and new group name are required' });
    }

    if (oldGroupName.trim() === newGroupName.trim()) {
      return res.status(400).json({ error: 'New group name must be different from old group name' });
    }

    if (newGroupName.trim().length === 0) {
      return res.status(400).json({ error: 'New group name cannot be empty' });
    }

    const supabase = getConnection();

    // Verify user has access to documents in this group
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id')
      .eq('user_id', userId.toString())
      .eq('group_name', oldGroupName);

    if (docsError) {
      console.error('Error fetching documents:', docsError);
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    if (!documents || documents.length === 0) {
      return res.status(404).json({ error: 'No documents found for this group' });
    }

    // Update display_name for all documents in the group (not group_name - keep system group_name intact)
    // Note: display_name is not unique, allowing multiple groups to have the same display name
    const { error: updateError } = await supabase
      .from('documents')
      .update({ display_name: newGroupName.trim() })
      .eq('user_id', userId.toString())
      .eq('group_name', oldGroupName);

    if (updateError) {
      console.error('Error updating display name:', updateError);
      return res.status(500).json({ error: 'Failed to update display name' });
    }

    return res.status(200).json({
      success: true,
      message: 'Group name updated successfully',
      oldGroupName,
      newGroupName: newGroupName.trim(),
      documentsUpdated: documents.length
    });

  } catch (error: any) {
    console.error('Error updating group name:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
