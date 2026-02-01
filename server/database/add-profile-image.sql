-- Add profile_image column to users table
-- This stores the path to the user's profile image

-- For Supabase/PostgreSQL
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500);

-- For MySQL (if using MySQL)
-- ALTER TABLE users 
-- ADD COLUMN profile_image VARCHAR(500) NULL;

-- Add index for faster queries (optional)
CREATE INDEX IF NOT EXISTS idx_users_profile_image ON users(profile_image);
