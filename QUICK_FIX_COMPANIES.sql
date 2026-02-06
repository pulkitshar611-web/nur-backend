-- QUICK FIX: Create Companies Table
-- Run this in MySQL to fix login error immediately

USE truck_management;

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default company
INSERT INTO companies (name) VALUES ('Noor Trucking Inc.')
ON DUPLICATE KEY UPDATE name=name;

-- Get the company ID
SET @company_id = (SELECT id FROM companies WHERE name = 'Noor Trucking Inc.' LIMIT 1);

-- Ensure users table has company_id column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS company_id INT NOT NULL DEFAULT 1 AFTER role;

-- Update all users to have company_id
UPDATE users SET company_id = @company_id WHERE company_id IS NULL OR company_id = 0;

-- Add foreign key if it doesn't exist
SET @fk_check = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND CONSTRAINT_NAME = 'fk_users_company'
);

SET @sql = IF(@fk_check = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE',
  'SELECT "FK already exists" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Companies table created successfully! Login should work now.' AS Status;

