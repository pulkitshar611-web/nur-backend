-- ============================================
-- FIX LOGIN ERROR: Create Companies Table
-- ============================================
-- This fixes: "Table 'truck_management.companies' doesn't exist"
-- Run this SQL file in your MySQL database

USE truck_management;

-- Step 1: Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Insert default company
INSERT IGNORE INTO companies (id, name) VALUES (1, 'Noor Trucking Inc.');

-- Step 3: Check if users table exists and add company_id if needed
SET @table_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users'
);

-- If users table exists, check if company_id column exists
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'company_id'
);

-- Add company_id column if it doesn't exist
SET @sql = IF(@table_exists > 0 AND @col_exists = 0,
  'ALTER TABLE users ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER role',
  'SELECT "Column already exists or users table not found" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing users to have company_id = 1
UPDATE users SET company_id = 1 WHERE company_id IS NULL OR company_id = 0;

-- Add foreign key constraint
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND CONSTRAINT_NAME = 'fk_users_company'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE',
  'SELECT "Foreign key already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 4: Create default admin user if doesn't exist
-- Password: 'password' (bcrypt hash)
INSERT IGNORE INTO users (email, password, role, company_id) VALUES 
('admin@m.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', 1);

-- Success message
SELECT '✅ Companies table created successfully!' AS Status;
SELECT '✅ Login should work now!' AS Message;
SELECT '📧 Default admin: admin@m.com' AS Email;
SELECT '🔑 Password: password' AS Password;

