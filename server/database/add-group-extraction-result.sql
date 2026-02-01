-- Add group_name column to extraction_results table
-- This allows us to create group-level extraction results
-- Group results will have document_id = NULL and group_name set
-- Individual document results will have document_id set and group_name = NULL (or can be set for reference)

ALTER TABLE extraction_results 
ADD COLUMN IF NOT EXISTS group_name VARCHAR(255);

-- Add index for faster group queries
CREATE INDEX IF NOT EXISTS idx_extraction_results_group_name ON extraction_results(group_name);

-- Make document_id nullable (for group-level results)
ALTER TABLE extraction_results 
ALTER COLUMN document_id DROP NOT NULL;

-- Add check constraint: either document_id or group_name must be set
ALTER TABLE extraction_results 
ADD CONSTRAINT check_document_or_group 
CHECK (document_id IS NOT NULL OR group_name IS NOT NULL);
