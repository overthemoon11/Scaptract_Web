import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import FAQModel from '../../models/supabase/FAQ.ts';

// Use FAQModel as FAQ for backward compatibility
const FAQ = FAQModel;

export default async function handler(req: Request, res: Response) {
  try {
    await requireAuth(req, 'admin');
    
    if (req.method === 'GET') {
      // Handle GET request with optional id query parameter
      const { id } = req.query;
      
      if (id) {
        // Get single FAQ
        const faq = await FAQ.findById(id as string);
        if (!faq) {
          return res.status(404).json({ error: 'FAQ not found.' });
        }
        return res.status(200).json({
          id: faq.id?.toString() || '',
          _id: faq.id?.toString() || '',
          question: faq.question,
          title: faq.question,
          answer: faq.answer,
          description: faq.answer,
          status: faq.status || 'active',
          created_at: faq.created_at || null,
          createdAt: faq.created_at || null
        });
      } else {
        // Get all FAQs
        const allFaqs = await FAQ.findAll();
        return res.status(200).json(
          allFaqs.map(faq => ({
            id: faq.id?.toString() || '',
            _id: faq.id?.toString() || '',
            question: faq.question,
            title: faq.question,
            answer: faq.answer,
            description: faq.answer,
            status: faq.status || 'active',
            created_at: faq.created_at || null,
            createdAt: faq.created_at || null
          }))
        );
      }
    } else if (req.method === 'POST') {
      const { title, description, status } = req.body;
      if (!title || !title.trim() || !description || !description.trim()) {
        return res.status(400).json({ error: 'Title and description are required.' });
      }
      try {
        const faqId = await FAQ.create({ 
          title: title.trim(), 
          description: description.trim(), 
          status: status || 'active' 
        });
        const faq = await FAQ.findById(faqId);
        if (!faq) {
          console.error('FAQ created but not found after creation');
          return res.status(500).json({ error: 'Failed to create FAQ.' });
        }
        return res.status(201).json({
          id: faq.id?.toString() || '',
          _id: faq.id?.toString() || '',
          question: faq.question,
          title: faq.title,
          answer: faq.answer,
          description: faq.description,
          status: faq.status || 'active',
          created_at: faq.created_at || null,
          createdAt: faq.created_at || null
        });
      } catch (err: any) {
        console.error('Error creating FAQ:', err);
        console.error('Error details:', {
          message: err.message,
          code: err.code,
          details: err.details,
          hint: err.hint
        });
        return res.status(500).json({ 
          error: err.message || err.details || 'Failed to create FAQ.' 
        });
      }
  } else if (req.method === 'PUT') {
    const { id } = req.query;
    const { title, description, status } = req.body;
    if (!id || !title || !description) {
      return res.status(400).json({ error: 'ID, title, and description are required.' });
    }
    try {
      await FAQ.update(id as string, { title, description, status: status || 'active' });
      const faq = await FAQ.findById(id as string);
      if (!faq) return res.status(404).json({ error: 'FAQ not found.' });
      return res.status(200).json({
        id: faq.id?.toString() || '',
        _id: faq.id?.toString() || '',
        question: faq.question,
        title: faq.title,
        answer: faq.answer,
        description: faq.description,
        status: faq.status || 'active',
        created_at: faq.created_at || null,
        createdAt: faq.created_at || null
      });
    } catch (err: any) {
      console.error('Error updating FAQ:', err);
      return res.status(500).json({ error: err.message || 'Failed to update FAQ.' });
    }
  } else if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'ID is required.' });
    }
    try {
      const faq = await FAQ.findById(id as string);
      if (!faq) return res.status(404).json({ error: 'FAQ not found.' });
      await FAQ.delete(id as string);
      return res.status(200).json({ message: 'FAQ deleted.' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete FAQ.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  } catch (err: any) {
    console.error('Error in FAQ handler:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
}

