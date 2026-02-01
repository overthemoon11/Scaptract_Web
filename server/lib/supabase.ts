import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const supabaseUrlEnv = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// For local Supabase instances, keys might not be required
// Use a dummy key if none is provided (local instances may accept any key)
const DUMMY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

if (!supabaseUrlEnv) {
  throw new Error('Missing SUPABASE_URL environment variable. Please set SUPABASE_URL');
}

// After the check, TypeScript/esbuild knows this is a string
const supabaseUrl = supabaseUrlEnv as string;

// Determine if we're using a local instance (typically localhost or 127.0.0.1)
const isLocalInstance = supabaseUrl.includes('localhost') || 
                       supabaseUrl.includes('127.0.0.1') || 
                       supabaseUrl.includes('0.0.0.0');

// Use dummy key for local instances if no key is provided
const effectiveAnonKey = supabaseAnonKey || (isLocalInstance ? DUMMY_KEY : '');
const effectiveServiceKey = supabaseServiceKey || (isLocalInstance ? DUMMY_KEY : '');

if (!isLocalInstance && !supabaseAnonKey) {
  console.warn('⚠️  SUPABASE_ANON_KEY not set. This may cause issues with cloud Supabase instances.');
}

// Client for user operations (uses anon key - respects RLS)
let supabaseClient: SupabaseClient | null = null;

// Admin client for server operations (uses service role key - bypasses RLS)
let supabaseAdminClient: SupabaseClient | null = null;

/**
 * Get Supabase client for user operations (respects Row Level Security)
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const key = effectiveAnonKey || DUMMY_KEY;
    supabaseClient = createClient(supabaseUrl, key, {
      auth: {
        persistSession: false
      }
    });
    
    if (isLocalInstance && !supabaseAnonKey) {
      console.log('ℹ️  Using local Supabase instance without authentication key');
    }
  }
  return supabaseClient;
}

/**
 * Get Supabase admin client for server operations (bypasses RLS)
 * Use this for server-side operations that need full access
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!supabaseAdminClient) {
    const key = effectiveServiceKey || effectiveAnonKey || DUMMY_KEY;
    supabaseAdminClient = createClient(supabaseUrl, key, {
      auth: {
        persistSession: false
      }
    });
    
    if (isLocalInstance && !supabaseServiceKey && !supabaseAnonKey) {
      console.log('ℹ️  Using local Supabase instance without authentication key');
    } else if (!supabaseServiceKey) {
      console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set, using anon key. Some operations may fail.');
    }
  }
  return supabaseAdminClient;
}

/**
 * Connect to Supabase (for compatibility with existing code)
 * Returns the admin client for server operations
 */
export async function connectDB(): Promise<SupabaseClient> {
  const client = getSupabaseAdminClient();
  
  // Test connection - try a simple query
  try {
    const { error } = await client.from('users').select('count').limit(1);
    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      // PGRST116 = "no rows returned" (fine)
      // 42P01 = "relation does not exist" (schema not set up yet, but connection works)
      console.error('Supabase connection error:', error);
      throw error;
    }
    console.log(`Connected to Supabase database${isLocalInstance ? ' (local)' : ''}`);
  } catch (error: any) {
    // If it's a schema error, connection is still working
    if (error.code === '42P01') {
      console.log(`Connected to Supabase database${isLocalInstance ? ' (local)' : ''} - Schema not initialized yet`);
    } else {
      throw error;
    }
  }
  
  return client;
}

/**
 * Get connection (alias for getSupabaseAdminClient for compatibility)
 */
export function getConnection(): SupabaseClient {
  return getSupabaseAdminClient();
}

