-- Multi-Tenancy Migration Script
-- Adds company support to existing database
-- Run this script on your existing database to add company functionality
-- NOTE: This script uses MySQL 8.0+ syntax. For older versions, you may need to adjust.

-- Step 1: Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Insert default company "Noor Trucking Inc."
INSERT INTO companies (name) VALUES ('Noor Trucking Inc.')
ON DUPLICATE KEY UPDATE name=name;

-- Step 3: Get the default company ID (we'll use this for existing data)
SET @default_company_id = (SELECT id FROM companies WHERE name = 'Noor Trucking Inc.' LIMIT 1);

-- Step 4: Add company_id to users table (check if column exists first)
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'company_id'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN company_id INT NULL AFTER role',
  'SELECT "Column company_id already exists in users table" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing users to default company
UPDATE users SET company_id = @default_company_id WHERE company_id IS NULL;

-- Add index and foreign key
SET @index_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND INDEX_NAME = 'idx_company_id'
);

SET @sql = IF(@index_exists = 0,
  'ALTER TABLE users ADD INDEX idx_company_id (company_id)',
  'SELECT "Index idx_company_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make company_id NOT NULL and add foreign key
ALTER TABLE users 
MODIFY COLUMN company_id INT NOT NULL;

ALTER TABLE users 
ADD CONSTRAINT fk_users_company 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Step 5: Add company_id to drivers table
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'drivers' 
  AND COLUMN_NAME = 'company_id'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE drivers ADD COLUMN company_id INT NULL AFTER user_id',
  'SELECT "Column company_id already exists in drivers table" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing drivers to default company (via their user_id)
UPDATE drivers d
JOIN users u ON d.user_id = u.id
SET d.company_id = u.company_id
WHERE d.company_id IS NULL;

-- Add index
SET @index_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'drivers' 
  AND INDEX_NAME = 'idx_company_id'
);

SET @sql = IF(@index_exists = 0,
  'ALTER TABLE drivers ADD INDEX idx_company_id (company_id)',
  'SELECT "Index idx_company_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make company_id NOT NULL and add foreign key
ALTER TABLE drivers 
MODIFY COLUMN company_id INT NOT NULL;

ALTER TABLE drivers 
ADD CONSTRAINT fk_drivers_company 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Update unique constraint on user_id_code to be company-scoped
ALTER TABLE drivers DROP INDEX IF EXISTS user_id_code;
ALTER TABLE drivers 
ADD UNIQUE KEY unique_company_user_id_code (company_id, user_id_code);

-- Step 6: Add company_id to customers table
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'customers' 
  AND COLUMN_NAME = 'company_id'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE customers ADD COLUMN company_id INT NULL AFTER id',
  'SELECT "Column company_id already exists in customers table" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing customers to default company
UPDATE customers SET company_id = @default_company_id WHERE company_id IS NULL;

-- Remove old UNIQUE constraint on name, add company-scoped unique
ALTER TABLE customers DROP INDEX IF EXISTS name;
ALTER TABLE customers 
ADD INDEX idx_name (name);

-- Add index and foreign key
SET @index_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'customers' 
  AND INDEX_NAME = 'idx_company_id'
);

SET @sql = IF(@index_exists = 0,
  'ALTER TABLE customers ADD INDEX idx_company_id (company_id)',
  'SELECT "Index idx_company_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make company_id NOT NULL and add constraints
ALTER TABLE customers 
MODIFY COLUMN company_id INT NOT NULL;

ALTER TABLE customers 
ADD CONSTRAINT fk_customers_company 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE customers 
ADD UNIQUE KEY unique_company_customer (company_id, name);

-- Step 7: Add company_id to trucks table
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'trucks' 
  AND COLUMN_NAME = 'company_id'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE trucks ADD COLUMN company_id INT NULL AFTER id',
  'SELECT "Column company_id already exists in trucks table" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing trucks to default company
UPDATE trucks SET company_id = @default_company_id WHERE company_id IS NULL;

-- Remove old UNIQUE constraint on truck_number, add company-scoped unique
ALTER TABLE trucks DROP INDEX IF EXISTS truck_number;
ALTER TABLE trucks 
ADD INDEX idx_truck_number (truck_number);

-- Add index and foreign key
SET @index_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'trucks' 
  AND INDEX_NAME = 'idx_company_id'
);

SET @sql = IF(@index_exists = 0,
  'ALTER TABLE trucks ADD INDEX idx_company_id (company_id)',
  'SELECT "Index idx_company_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make company_id NOT NULL and add constraints
ALTER TABLE trucks 
MODIFY COLUMN company_id INT NOT NULL;

ALTER TABLE trucks 
ADD CONSTRAINT fk_trucks_company 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE trucks 
ADD UNIQUE KEY unique_company_truck (company_id, truck_number);

-- Step 8: Add company_id to tickets table
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'tickets' 
  AND COLUMN_NAME = 'company_id'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE tickets ADD COLUMN company_id INT NULL AFTER id',
  'SELECT "Column company_id already exists in tickets table" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing tickets to default company (via driver_id)
UPDATE tickets t
JOIN drivers d ON t.driver_id = d.id
SET t.company_id = d.company_id
WHERE t.company_id IS NULL;

-- Add index
SET @index_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'tickets' 
  AND INDEX_NAME = 'idx_company_id'
);

SET @sql = IF(@index_exists = 0,
  'ALTER TABLE tickets ADD INDEX idx_company_id (company_id)',
  'SELECT "Index idx_company_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make company_id NOT NULL and add foreign key
ALTER TABLE tickets 
MODIFY COLUMN company_id INT NOT NULL;

ALTER TABLE tickets 
ADD CONSTRAINT fk_tickets_company 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Success message
SELECT 'Company migration completed successfully! All existing data has been assigned to "Noor Trucking Inc."' AS Status;
