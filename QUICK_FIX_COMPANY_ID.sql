-- ============================================
-- QUICK FIX: Add company_id to ALL tables
-- ============================================
-- Run this to fix "Unknown column 'company_id' in 'where clause'" errors

USE truck_management;

-- Ensure companies table exists
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO companies (id, name) VALUES (1, 'Noor Trucking Inc.');

-- Fix USERS table
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'company_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER role', 'SELECT "users.company_id exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE users SET company_id = 1 WHERE company_id IS NULL OR company_id = 0;

-- Fix DRIVERS table
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drivers' AND COLUMN_NAME = 'company_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE drivers ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER user_id', 'SELECT "drivers.company_id exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE drivers SET company_id = 1 WHERE company_id IS NULL OR company_id = 0;

-- Fix CUSTOMERS table
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'company_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE customers ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id', 'SELECT "customers.company_id exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE customers SET company_id = 1 WHERE company_id IS NULL OR company_id = 0;

-- Fix TRUCKS table
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trucks' AND COLUMN_NAME = 'company_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE trucks ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id', 'SELECT "trucks.company_id exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE trucks SET company_id = 1 WHERE company_id IS NULL OR company_id = 0;

-- Fix TICKETS table (THIS IS THE MAIN ONE CAUSING YOUR ERROR)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'company_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE tickets ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id', 'SELECT "tickets.company_id exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE tickets SET company_id = 1 WHERE company_id IS NULL OR company_id = 0;

-- Add indexes (check if they exist first)
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_company_id');
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE tickets ADD INDEX idx_company_id (company_id)', 'SELECT "Index exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_company_id');
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE customers ADD INDEX idx_company_id (company_id)', 'SELECT "Index exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drivers' AND INDEX_NAME = 'idx_company_id');
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE drivers ADD INDEX idx_company_id (company_id)', 'SELECT "Index exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trucks' AND INDEX_NAME = 'idx_company_id');
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE trucks ADD INDEX idx_company_id (company_id)', 'SELECT "Index exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT '✅ All company_id columns added successfully!' AS Status;

