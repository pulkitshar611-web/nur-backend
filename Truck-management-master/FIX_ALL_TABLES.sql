-- ============================================
-- FIX ALL TABLES: Add company_id to all tables
-- ============================================
-- This fixes: "Unknown column 'company_id' in 'where clause'"
-- Run this to fix all 500 errors
-- IMPORTANT: Run this file in MySQL to fix all database issues

USE truck_management;

-- ============================================
-- STEP 1: Ensure companies table exists
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO companies (id, name) VALUES (1, 'Noor Trucking Inc.');

SET @default_company_id = 1;

-- ============================================
-- STEP 2: Fix USERS table
-- ============================================
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'company_id'
);

SET @sql = IF(@col_exists = 0,
  CONCAT('ALTER TABLE users ADD COLUMN company_id INT NOT NULL DEFAULT ', @default_company_id, ' AFTER role'),
  'SELECT "users.company_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE users SET company_id = @default_company_id WHERE company_id IS NULL OR company_id = 0;

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

-- ============================================
-- STEP 3: Fix DRIVERS table
-- ============================================
SET @table_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'drivers'
);

SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'drivers' 
  AND COLUMN_NAME = 'company_id'
);

SET @sql = IF(@table_exists > 0 AND @col_exists = 0,
  CONCAT('ALTER TABLE drivers ADD COLUMN company_id INT NOT NULL DEFAULT ', @default_company_id, ' AFTER user_id'),
  'SELECT "drivers.company_id already exists or table not found" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE drivers SET company_id = @default_company_id WHERE company_id IS NULL OR company_id = 0;

-- Add foreign key
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'drivers' 
  AND CONSTRAINT_NAME = 'fk_drivers_company'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE drivers ADD CONSTRAINT fk_drivers_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE',
  'SELECT "FK already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- STEP 4: Fix CUSTOMERS table
-- ============================================
SET @table_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'customers'
);

SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'customers' 
  AND COLUMN_NAME = 'company_id'
);

SET @sql = IF(@table_exists > 0 AND @col_exists = 0,
  CONCAT('ALTER TABLE customers ADD COLUMN company_id INT NOT NULL DEFAULT ', @default_company_id, ' AFTER id'),
  'SELECT "customers.company_id already exists or table not found" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE customers SET company_id = @default_company_id WHERE company_id IS NULL OR company_id = 0;

-- Add foreign key
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'customers' 
  AND CONSTRAINT_NAME = 'fk_customers_company'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE customers ADD CONSTRAINT fk_customers_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE',
  'SELECT "FK already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- STEP 5: Fix TRUCKS table
-- ============================================
SET @table_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'trucks'
);

SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'trucks' 
  AND COLUMN_NAME = 'company_id'
);

SET @sql = IF(@table_exists > 0 AND @col_exists = 0,
  CONCAT('ALTER TABLE trucks ADD COLUMN company_id INT NOT NULL DEFAULT ', @default_company_id, ' AFTER id'),
  'SELECT "trucks.company_id already exists or table not found" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE trucks SET company_id = @default_company_id WHERE company_id IS NULL OR company_id = 0;

-- Add foreign key
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'trucks' 
  AND CONSTRAINT_NAME = 'fk_trucks_company'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE trucks ADD CONSTRAINT fk_trucks_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE',
  'SELECT "FK already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- STEP 6: Fix TICKETS table
-- ============================================
SET @table_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'tickets'
);

SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'tickets' 
  AND COLUMN_NAME = 'company_id'
);

SET @sql = IF(@table_exists > 0 AND @col_exists = 0,
  CONCAT('ALTER TABLE tickets ADD COLUMN company_id INT NOT NULL DEFAULT ', @default_company_id, ' AFTER id'),
  'SELECT "tickets.company_id already exists or table not found" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE tickets SET company_id = @default_company_id WHERE company_id IS NULL OR company_id = 0;

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

-- ============================================
-- STEP 7: Create Master Data Tables
-- ============================================

-- Customer Master
CREATE TABLE IF NOT EXISTS customer_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL UNIQUE,
  billing_enabled BOOLEAN DEFAULT TRUE,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer_name (customer_name),
  INDEX idx_billing_enabled (billing_enabled),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Equipment Type Master
CREATE TABLE IF NOT EXISTS equipment_type_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  equipment_name VARCHAR(255) NOT NULL UNIQUE,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_equipment_name (equipment_name),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default equipment types
INSERT INTO equipment_type_master (equipment_name, status) VALUES
('Tandem', 'Active'),
('Tri End Dump', 'Active'),
('Livebottom', 'Active'),
('Tri Pup', 'Active'),
('Super B', 'Active'),
('Quad', 'Active')
ON DUPLICATE KEY UPDATE equipment_name=equipment_name;

-- Truck Number Master
CREATE TABLE IF NOT EXISTS truck_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  truck_number VARCHAR(50) NOT NULL UNIQUE,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_truck_number (truck_number),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default truck numbers
INSERT INTO truck_master (truck_number, status) VALUES
('9727', 'Active'),
('9728', 'Active'),
('4184', 'Active'),
('6635', 'Active'),
('9780', 'Active'),
('7354', 'Active'),
('7396', 'Active'),
('7860', 'Active')
ON DUPLICATE KEY UPDATE truck_number=truck_number;

-- Company Settings
CREATE TABLE IF NOT EXISTS company_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL DEFAULT 'Noor Trucking Inc.',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO company_settings (company_name) VALUES ('Noor Trucking Inc.')
ON DUPLICATE KEY UPDATE company_name=company_name;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT '✅ All tables fixed successfully!' AS Status;
SELECT '✅ company_id columns added to all tables' AS Message;
SELECT '✅ Master data tables created' AS MasterData;
SELECT '✅ Login and dashboard should work now!' AS Ready;

