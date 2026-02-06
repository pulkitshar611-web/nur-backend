-- Complete Database Setup Script
-- Run this script to set up the entire database from scratch
-- This fixes the "companies table doesn't exist" error

-- ============================================
-- STEP 1: CREATE COMPANIES TABLE
-- ============================================
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

-- Get default company ID
SET @default_company_id = (SELECT id FROM companies WHERE name = 'Noor Trucking Inc.' LIMIT 1);

-- ============================================
-- STEP 2: CREATE USERS TABLE (if doesn't exist)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'driver', 'company') NOT NULL,
  company_id INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add company_id column if it doesn't exist
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'company_id'
);

SET @sql = IF(@col_exists = 0,
  CONCAT('ALTER TABLE users ADD COLUMN company_id INT NOT NULL DEFAULT ', @default_company_id, ' AFTER role'),
  'SELECT "Column company_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing users to have company_id
UPDATE users 
SET company_id = @default_company_id 
WHERE company_id IS NULL OR company_id = 0 OR company_id NOT IN (SELECT id FROM companies);

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

-- ============================================
-- STEP 3: CREATE OTHER REQUIRED TABLES
-- ============================================

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  company_id INT NOT NULL,
  user_id_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  default_pay_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  pin VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_company_user_id_code (company_id, user_id_code),
  INDEX idx_user_id_code (user_id_code),
  INDEX idx_name (name),
  INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255) NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(255) NULL,
  billing_enabled BOOLEAN DEFAULT TRUE,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  default_bill_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_company_customer (company_id, name),
  INDEX idx_name (name),
  INDEX idx_company_id (company_id),
  INDEX idx_billing_enabled (billing_enabled),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trucks table
CREATE TABLE IF NOT EXISTS trucks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  truck_number VARCHAR(50) NOT NULL,
  truck_type ENUM('Box Truck', 'Semi', 'Pickup') NULL,
  assigned_customer_id INT NULL,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  UNIQUE KEY unique_company_truck (company_id, truck_number),
  INDEX idx_truck_number (truck_number),
  INDEX idx_company_id (company_id),
  INDEX idx_truck_type (truck_type),
  INDEX idx_assigned_customer (assigned_customer_id),
  INDEX idx_truck_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Driver Customers table
CREATE TABLE IF NOT EXISTS driver_customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  customer_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_driver_customer (driver_id, customer_id),
  INDEX idx_driver_id (driver_id),
  INDEX idx_customer_id (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  driver_id INT NOT NULL,
  date DATE NOT NULL,
  truck_number VARCHAR(50),
  customer VARCHAR(255) NOT NULL,
  job_type VARCHAR(255),
  equipment_type VARCHAR(255),
  ticket_number VARCHAR(100) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  photo_path VARCHAR(500),
  bill_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  pay_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_bill DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_pay DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  INDEX idx_driver_id (driver_id),
  INDEX idx_date (date),
  INDEX idx_customer (customer),
  INDEX idx_ticket_number (ticket_number),
  INDEX idx_status (status),
  INDEX idx_equipment_type (equipment_type),
  INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STEP 4: CREATE MASTER DATA TABLES
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

-- Insert default company settings
INSERT INTO company_settings (company_name) VALUES ('Noor Trucking Inc.')
ON DUPLICATE KEY UPDATE company_name=company_name;

-- ============================================
-- STEP 5: INSERT DEFAULT ADMIN USER
-- ============================================
-- Password hash for 'password': $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
INSERT INTO users (email, password, role, company_id) VALUES 
('admin@m.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', @default_company_id)
ON DUPLICATE KEY UPDATE company_id=@default_company_id;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Database setup completed successfully! Login should work now.' AS Status;
SELECT 'Default admin credentials: email: admin@m.com, password: password' AS LoginInfo;

