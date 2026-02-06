-- ============================================
-- QUICK FIX: Add company_id to tickets table
-- ============================================
-- Run this if you're getting "Unknown column 't.company_id' in 'where clause'"

USE truck_management;

-- Step 1: Ensure companies table exists
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO companies (id, name) VALUES (1, 'Noor Trucking Inc.');

-- Step 2: Add company_id to tickets table
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'tickets' 
  AND COLUMN_NAME = 'company_id'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE tickets ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id',
  'SELECT "Column already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing tickets
UPDATE tickets SET company_id = 1 WHERE company_id IS NULL OR company_id = 0;

-- Add foreign key
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'tickets' 
  AND CONSTRAINT_NAME = 'fk_tickets_company'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE tickets ADD CONSTRAINT fk_tickets_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE',
  'SELECT "FK already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for better performance
ALTER TABLE tickets ADD INDEX IF NOT EXISTS idx_company_id (company_id);

SELECT '✅ Tickets table fixed! company_id column added.' AS Status;

