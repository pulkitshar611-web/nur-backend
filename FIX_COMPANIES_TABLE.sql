-- Fix Companies Table - Create if doesn't exist
-- This script creates the companies table required for login

-- Create companies table if it doesn't exist
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default company if none exists
INSERT INTO companies (name) 
SELECT 'Default Company' 
WHERE NOT EXISTS (SELECT 1 FROM companies LIMIT 1);

-- Update users table to ensure company_id exists
-- First check if company_id column exists in users table
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'company_id'
);

-- If column doesn't exist, add it
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER role',
  'SELECT "Column company_id already exists in users table" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Get default company ID
SET @default_company_id = (SELECT id FROM companies LIMIT 1);

-- Update users without company_id to default company
UPDATE users 
SET company_id = @default_company_id 
WHERE company_id IS NULL OR company_id = 0;

-- Add foreign key constraint if it doesn't exist
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND CONSTRAINT_NAME = 'fk_users_company'
);

SET @sql = IF(@fk_exists = 0,
  CONCAT('ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE'),
  'SELECT "Foreign key fk_users_company already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Success message
SELECT 'Companies table created/verified successfully! Login should work now.' AS Status;

