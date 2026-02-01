import { Request, Response } from 'express';
import FAQModel from '../../models/supabase/FAQ.ts';

// Use FAQModel as FAQ for backward compatibility
const FAQ = FAQModel;

/**
 * Public FAQ endpoint - returns only active FAQs
 * No authentication required
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get only active FAQs for public display
    const activeFaqs = await FAQ.findActive();
    
    return res.status(200).json(
      activeFaqs.map(faq => ({
        id: faq.id?.toString() || '',
        _id: faq.id?.toString() || '',
        question: faq.question,
        title: faq.title || faq.question,
        answer: faq.answer,
        description: faq.description || faq.answer,
        status: faq.status || 'active',
        created_at: faq.created_at || null,
        createdAt: faq.created_at || null,
        updated_at: faq.updated_at || null,
        updatedAt: faq.updated_at || null
      }))
    );
  } catch (err: any) {
    console.error('Error fetching FAQs:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch FAQs' });
  }
}
