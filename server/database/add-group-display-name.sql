-- Add display_name column to documents table
-- This stores the user-customized group name for display purposes
-- The system group_name remains unchanged for internal logic

-- For Supabase/PostgreSQL
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

-- For MySQL (if using MySQL)
-- ALTER TABLE documents 
-- ADD COLUMN display_name VARCHAR(255) NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_documents_display_name ON documents(display_name);
