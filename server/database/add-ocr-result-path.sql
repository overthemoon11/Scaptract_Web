-- Add ocr_result_path to extraction_results and processing_completed_at to documents
-- ocr_result_path: stores the base path where OCR markdown and images are saved
-- Format: uploads/ocr-results/{groupname}/
-- processing_completed_at: timestamp when OCR processing completed (documents table)

-- For Supabase (PostgreSQL)
ALTER TABLE extraction_results 
ADD COLUMN IF NOT EXISTS ocr_result_path VARCHAR(500);

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP WITH TIME ZONE;

-- For MySQL (if using MySQL)
-- ALTER TABLE extraction_results 
-- ADD COLUMN ocr_result_path VARCHAR(500) NULL;

-- ALTER TABLE documents 
-- ADD COLUMN processing_completed_at TIMESTAMP NULL;

-- Add index for faster lookups by path
CREATE INDEX IF NOT EXISTS idx_extraction_results_ocr_path ON extraction_results(ocr_result_path);
