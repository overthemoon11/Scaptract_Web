export interface User {
  _id?: string;
  id?: string | number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  status?: string;
  password?: string;
  profile_image?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  message: string;
  user?: User;
  devMode?: boolean;
}

export interface ApiError {
  error: string;
  status?: number;
}

export interface Document {
  id: string | number;
  user_id: string | number;
  file_type_id: string | number;
  file_id?: string | null;
  group_name?: string | null;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  page_count?: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface Notification {
  id: string | number;
  user_id: string | number;
  title: string;
  message: string;
  type: string;
  // read?: boolean; // Backend compatibility field
  is_read?: boolean; // Database field
  created_at: string;
}

export interface SupportTicket {
  id?: string | number;
  _id?: string | number;
  user_id: string | number;
  title?: string;
  subject?: string;
  description?: string;
  message?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface FAQ {
  id?: string | number;
  _id?: string | number;
  question?: string;
  title?: string;
  answer?: string;
  description?: string;
  status?: 'active' | 'banned';
  category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExtractionResult {
  id?: string | number;
  document_id: string | number;
  extracted_text?: string | null;
  structured_data?: string | null;
  accuracy?: number;
  processing_time_ms?: number;
  extraction_method?: string;
  status?: string;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OTPData {
  id?: number;
  email: string;
  otp_code: string;
  expires_at: Date | string;
  used?: boolean;
  user_info?: string | object;
  created_at?: string;
}

export interface FileType {
  id?: string | number;
  name: string;
  extension: string;
  mime_type: string;
  is_supported?: boolean;
  max_size_mb?: number;
  created_at?: string;
  updated_at?: string;
}

