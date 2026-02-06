-- ============================================
-- SAFE FIX: Add company_id only if missing
-- ============================================
-- Ye script check karega ki column hai ya nahi, phir add karega
-- Duplicate column error nahi aayega

USE truck_management;

-- Step 1: Companies table
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO companies (id, name) VALUES (1, 'Noor Trucking Inc.');

-- Step 2: Users table - check first, then add
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'users' 
                   AND COLUMN_NAME = 'company_id');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE users ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER role',
              'SELECT "users.company_id already exists - skipping" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
UPDATE users SET company_id = 1 WHERE company_id IS NULL OR company_id = 0;

-- Step 3: Drivers table
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'drivers' 
                   AND COLUMN_NAME = 'company_id');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE drivers ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER user_id',
              'SELECT "drivers.company_id already exists - skipping" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
UPDATE drivers SET company_id = 1 WHERE company_id IS NULL OR company_id = 0;

-- Step 4: Customers table
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'customers' 
                   AND COLUMN_NAME = 'company_id');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE customers ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id',
              'SELECT "customers.company_id already exists - skipping" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
UPDATE customers SET company_id = 1 WHERE company_id IS NULL OR company_id = 0;

-- Step 5: Trucks table
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'trucks' 
                   AND COLUMN_NAME = 'company_id');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE trucks ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id',
              'SELECT "trucks.company_id already exists - skipping" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
UPDATE trucks SET company_id = 1 WHERE company_id IS NULL OR company_id = 0;

-- Step 6: Tickets table (YEH MAIN ERROR HAI - ISKO FIX KARNA HAI)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'tickets' 
                   AND COLUMN_NAME = 'company_id');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE tickets ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id',
              'SELECT "tickets.company_id already exists - skipping" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
UPDATE tickets SET company_id = 1 WHERE company_id IS NULL OR company_id = 0;

-- Step 7: Master data tables
CREATE TABLE IF NOT EXISTS customer_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL UNIQUE,
  billing_enabled BOOLEAN DEFAULT TRUE,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipment_type_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  equipment_name VARCHAR(255) NOT NULL UNIQUE,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO equipment_type_master (equipment_name, status) VALUES
('Tandem', 'Active'),
('Tri End Dump', 'Active'),
('Livebottom', 'Active'),
('Tri Pup', 'Active'),
('Super B', 'Active'),
('Quad', 'Active')
ON DUPLICATE KEY UPDATE equipment_name=equipment_name;

CREATE TABLE IF NOT EXISTS truck_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  truck_number VARCHAR(50) NOT NULL UNIQUE,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS company_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL DEFAULT 'Noor Trucking Inc.',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO company_settings (company_name) VALUES ('Noor Trucking Inc.')
ON DUPLICATE KEY UPDATE company_name=company_name;

SELECT '✅ SUCCESS! Sab tables check aur fix ho gaye!' AS Status;

