import { getConnection } from '../../lib/supabase.ts';
import { FAQ } from '@shared/types/index.ts';

interface FAQData {
  id?: string;
  title?: string;
  question?: string;
  description?: string;
  answer?: string;
  status?: 'active' | 'banned';
  created_at?: string;
  updated_at?: string;
}

export class FAQModel {
  id?: string;
  title: string;
  question: string;
  description: string;
  answer: string;
  status: 'active' | 'banned';
  created_at?: string;
  updated_at?: string;

  constructor(data: FAQData) {
    this.id = data.id;
    this.title = data.title || data.question || '';
    this.question = data.question || data.title || '';
    this.description = data.description || data.answer || '';
    this.answer = data.answer || data.description || '';
    this.status = (data.status as 'active' | 'banned') || 'active';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(faqData: Omit<FAQData, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const supabase = getConnection();
    
    // Ensure we have required fields
    const title = faqData.title || faqData.question;
    const description = faqData.description || faqData.answer;
    
    if (!title || !title.trim()) {
      throw new Error('Title is required');
    }
    if (!description || !description.trim()) {
      throw new Error('Description is required');
    }
    
    const insertData = {
      title: title.trim(),
      description: description.trim(),
      status: faqData.status || 'active'
    };
    
    console.log('Attempting to insert FAQ:', insertData);
    
    const { data, error } = await supabase
      .from('faqs')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('Supabase error creating FAQ:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        fullError: error
      });
      
      // Provide more user-friendly error messages
      if (error.code === '42P01') {
        throw new Error('FAQs table does not exist. Please run the database migration.');
      } else if (error.code === '23505') {
        throw new Error('A FAQ with this title already exists.');
      } else if (error.code === '23502') {
        throw new Error('Required field is missing (title or description).');
      } else if (error.code === '42501') {
        throw new Error('Permission denied. Check your database permissions.');
      }
      
      throw new Error(error.message || 'Database error: ' + JSON.stringify(error));
    }
    
    if (!data || !data.id) {
      throw new Error('Failed to create FAQ: No ID returned from database');
    }
    
    console.log('FAQ created successfully with ID:', data.id);
    return data.id;
  }

  static async findById(id: string | number): Promise<FAQModel | null> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .eq('id', id.toString())
      .single();

    if (error || !data) return null;
    return new FAQModel(data);
  }

  static async findAll(): Promise<FAQModel[]> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: FAQData) => new FAQModel(row));
  }

  static async findActive(): Promise<FAQModel[]> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: FAQData) => new FAQModel(row));
  }

  static async update(id: string | number, updateData: Partial<FAQData>): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('faqs')
      .update(updateData)
      .eq('id', id.toString());

    if (error) throw error;
  }

  static async delete(id: string | number): Promise<void> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('faqs')
      .delete()
      .eq('id', id.toString());

    if (error) throw error;
  }
}

// Export as FAQ for backward compatibility
export default FAQModel;

