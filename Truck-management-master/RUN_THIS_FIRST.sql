-- ============================================
-- RUN THIS FILE FIRST TO FIX LOGIN ERROR
-- ============================================
-- Copy and paste this entire file into MySQL Workbench or MySQL command line
-- ============================================

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
INSERT IGNORE INTO companies (id, name) VALUES (1, 'Noor Trucking Inc.');

-- Add company_id to users table if it doesn't exist
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'company_id'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER role',
  'SELECT "Column already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing users
UPDATE users SET company_id = 1 WHERE company_id IS NULL OR company_id = 0;

-- Add foreign key
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND CONSTRAINT_NAME = 'fk_users_company'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE',
  'SELECT "FK already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create default admin user
INSERT IGNORE INTO users (email, password, role, company_id) VALUES 
('admin@m.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', 1);

SELECT 'SUCCESS! Companies table created. Login should work now.' AS Status;

